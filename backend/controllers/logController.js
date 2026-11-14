const LogEntry = require('../models/LogEntry');
const RegexRule = require('../models/RegexRule');
const {
  parseLogLine,
  validateRegexSafety,
  testRegexPattern,
  escapeRegExp,
} = require('../utils/regexParser');
const { generateSampleBatch } = require('../utils/sampleLogs');
const { probeTargetUrl } = require('../utils/urlProbe');

const MAX_INGEST_BATCH = 500;

/**
 * POST /api/logs/ingest
 * Accepts rawLogs (newline-delimited string or string[]) and optional source override.
 */
async function ingestLogs(req, res, next) {
  try {
    const { rawLogs, source } = req.body || {};
    let lines = [];

    if (Array.isArray(rawLogs)) {
      lines = rawLogs.map((l) => String(l).trim()).filter(Boolean);
    } else if (typeof rawLogs === 'string') {
      lines = rawLogs
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    } else {
      return res.status(400).json({
        success: false,
        message: 'rawLogs must be a non-empty string or an array of log lines.',
      });
    }

    if (lines.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid log lines provided for ingestion.',
      });
    }

    if (lines.length > MAX_INGEST_BATCH) {
      return res.status(400).json({
        success: false,
        message: `Batch exceeds maximum of ${MAX_INGEST_BATCH} log lines per request.`,
      });
    }

    const rules = await RegexRule.find({ createdBy: req.user._id, isActive: true }).sort({
      priority: 1,
    });

    const sourceOverride =
      source && ['nginx', 'apache', 'auth', 'api', 'custom'].includes(source)
        ? source
        : undefined;

    const docs = lines.map((line) => ({
      ...parseLogLine(line, rules, { sourceOverride }),
      owner: req.user._id,
    }));

    const inserted = await LogEntry.insertMany(docs, { ordered: false });
    const threatCount = inserted.filter((l) => l.isThreat).length;

    return res.status(201).json({
      success: true,
      ingestedCount: inserted.length,
      threatCount,
      logs: inserted,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/logs/simulate
 * Generates realistic multi-source telemetry + attack payloads for live streaming simulation.
 */
async function simulateLogs(req, res, next) {
  try {
    const count = Math.max(1, Math.min(Number(req.body?.count) || 8, 50));
    const threatRatio =
      req.body?.threatRatio !== undefined
        ? Math.max(0, Math.min(Number(req.body.threatRatio), 1))
        : 0.25;
    const spreadMinutes = Math.max(0, Math.min(Number(req.body?.spreadMinutes) || 0, 1440));

    const rules = await RegexRule.find({ createdBy: req.user._id, isActive: true }).sort({
      priority: 1,
    });

    const samples = generateSampleBatch(count, threatRatio, spreadMinutes);
    const docs = samples.map((sample) => ({
      ...parseLogLine(sample.raw, rules, {
        sourceOverride: sample.source,
        preserveTimestamp: spreadMinutes > 0,
      }),
      owner: req.user._id,
    }));

    const inserted = await LogEntry.insertMany(docs);
    const threatCount = inserted.filter((l) => l.isThreat).length;

    return res.status(201).json({
      success: true,
      ingestedCount: inserted.length,
      threatCount,
      logs: inserted,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/logs
 * Paginated, filterable log explorer query.
 */
async function getLogs(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 100));
    const { level, source, isThreat, threatType, statusCode, search, startDate, endDate } =
      req.query;

    const filter = { owner: req.user._id };

    if (level && ['INFO', 'WARN', 'ERROR', 'CRITICAL'].includes(level)) {
      filter.level = level;
    }
    if (source && ['nginx', 'apache', 'auth', 'api', 'custom'].includes(source)) {
      filter.source = source;
    }
    if (isThreat === 'true') filter.isThreat = true;
    if (isThreat === 'false') filter.isThreat = false;
    if (threatType && threatType !== 'ALL') {
      filter.threatType = String(threatType);
    }
    if (statusCode && /^\d{3}$/.test(String(statusCode))) {
      filter.statusCode = Number(statusCode);
    }

    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate && !Number.isNaN(Date.parse(startDate))) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate && !Number.isNaN(Date.parse(endDate))) {
        filter.timestamp.$lte = new Date(endDate);
      }
      if (Object.keys(filter.timestamp).length === 0) {
        delete filter.timestamp;
      }
    }

    if (search && String(search).trim()) {
      const safePattern = new RegExp(escapeRegExp(String(search).trim().slice(0, 120)), 'i');
      filter.$or = [
        { raw: safePattern },
        { path: safePattern },
        { ip: safePattern },
        { service: safePattern },
        { matchedRuleName: safePattern },
      ];
    }

    const [total, logs] = await Promise.all([
      LogEntry.countDocuments(filter),
      LogEntry.find(filter)
        .sort({ timestamp: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/logs/threats
 * Security threat feed & offending IP intelligence.
 */
async function getThreats(req, res, next) {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 50, 100));
    const acknowledgedFilter = req.query.acknowledged;

    const match = { owner: req.user._id, isThreat: true };
    if (acknowledgedFilter === 'true') match.acknowledged = true;
    if (acknowledgedFilter === 'false') match.acknowledged = false;

    const [threats, statsAgg] = await Promise.all([
      LogEntry.find(match).sort({ timestamp: -1 }).limit(limit).lean(),
      LogEntry.aggregate([
        { $match: { owner: req.user._id, isThreat: true } },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalThreats: { $sum: 1 },
                  unacknowledgedCount: {
                    $sum: { $cond: [{ $eq: ['$acknowledged', false] }, 1, 0] },
                  },
                  avgThreatScore: { $avg: '$threatScore' },
                },
              },
            ],
            byType: [
              { $group: { _id: '$threatType', count: { $sum: 1 }, maxScore: { $max: '$threatScore' } } },
              { $sort: { count: -1 } },
            ],
            topIps: [
              { $match: { ip: { $ne: null } } },
              {
                $group: {
                  _id: '$ip',
                  count: { $sum: 1 },
                  maxScore: { $max: '$threatScore' },
                  types: { $addToSet: '$threatType' },
                  lastSeen: { $max: '$timestamp' },
                },
              },
              { $sort: { count: -1, maxScore: -1 } },
              { $limit: 8 },
            ],
          },
        },
      ]),
    ]);

    const facetResult = statsAgg[0] || {};
    const totals = facetResult.totals?.[0] || {
      totalThreats: 0,
      unacknowledgedCount: 0,
      avgThreatScore: 0,
    };

    return res.status(200).json({
      success: true,
      threats,
      summary: {
        totalThreats: totals.totalThreats,
        unacknowledgedCount: totals.unacknowledgedCount,
        avgThreatScore: Math.round(totals.avgThreatScore || 0),
        byType: (facetResult.byType || []).map((item) => ({
          threatType: item._id,
          count: item.count,
          maxScore: item.maxScore,
        })),
        topIps: (facetResult.topIps || []).map((item) => ({
          ip: item._id,
          count: item.count,
          maxScore: item.maxScore,
          types: item.types,
          lastSeen: item.lastSeen,
        })),
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Resolves a deterministic remediation playbook for a detected threat/anomaly type.
 */
function resolveRemediationPlaybook(log) {
  const ipLabel = log.ip || 'source';
  const pathLabel = log.path || 'endpoint';

  switch (log.threatType) {
    case 'SQLI':
      return {
        action: 'WAF_SQLI_RULE_DEPLOYED',
        summary: `Blocked ${ipLabel} via WAF SQLi signature rule & enforced parameterized query guard on ${pathLabel}.`,
      };
    case 'PATH_TRAVERSAL':
      return {
        action: 'PATH_SANDBOX_ENFORCED',
        summary: `Applied canonical path normalization & directory sandbox block for ${ipLabel} on ${pathLabel}.`,
      };
    case 'XSS':
      return {
        action: 'CSP_XSS_SHIELD_ACTIVE',
        summary: `Enforced strict Content-Security-Policy & output encoding sanitization against ${ipLabel}.`,
      };
    case 'BRUTE_FORCE':
      return {
        action: 'IP_QUARANTINE_ENFORCED',
        summary: `Quarantined ${ipLabel} for 15m and enabled adaptive rate-limiting on authentication routes.`,
      };
    case 'SCANNER':
      return {
        action: 'EDGE_SCANNER_DROP',
        summary: `Deployed edge fingerprint drop rule blocking automated scanner traffic from ${ipLabel}.`,
      };
    case 'SERVER_ERROR':
      return {
        action: 'CIRCUIT_BREAKER_RESET',
        summary: `Recycled upstream worker pool & reset circuit breaker for ${log.service || 'service'} (${pathLabel}).`,
      };
    case 'ANOMALY':
      return {
        action: 'LATENCY_MITIGATION_APPLIED',
        summary: `Scaled edge cache & rebalanced upstream route ${pathLabel} to mitigate tail latency.`,
      };
    default:
      return {
        action: 'INCIDENT_MITIGATED',
        summary: `Applied automated mitigation & cleared alert for ${ipLabel}.`,
      };
  }
}

/**
 * POST /api/logs/probe-url
 * Probes a live external URL (with SSRF protection), audits latency/status/security headers,
 * parses the generated telemetry log via active RegexRules, and stores it in MongoDB.
 */
async function probeUrl(req, res, next) {
  try {
    const { url } = req.body || {};
    const probe = await probeTargetUrl(url);

    const rules = await RegexRule.find({ createdBy: req.user._id, isActive: true }).sort({
      priority: 1,
    });

    const parsed = parseLogLine(probe.rawLogLine, rules, { sourceOverride: 'api' });

    // Elevate security posture / reachability findings if not already flagged as 5xx/latency
    if (!parsed.isThreat && (!probe.reachable || !probe.isHttps || probe.securityScore < 55)) {
      parsed.isThreat = true;
      parsed.threatType = !probe.reachable ? 'SERVER_ERROR' : 'ANOMALY';
      parsed.threatScore = !probe.reachable ? 75 : !probe.isHttps ? 68 : 58;
      if (parsed.level === 'INFO') parsed.level = 'WARN';
    }

    parsed.parsedFields = {
      ...(parsed.parsedFields || {}),
      targetUrl: probe.targetUrl,
      finalUrl: probe.finalUrl,
      securityScore: probe.securityScore,
      grade: probe.grade,
      isHttps: probe.isHttps,
      missingHeaders: probe.missingHeaders,
      serverHeader: probe.serverHeader,
    };

    const savedLog = await LogEntry.create({
      ...parsed,
      owner: req.user._id,
    });

    return res.status(201).json({
      success: true,
      probe,
      log: savedLog,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/logs/:id/fix
 * Applies automated remediation playbook to a single log threat/anomaly and marks it resolved.
 */
async function fixIssue(req, res, next) {
  try {
    const log = await LogEntry.findOne({ _id: req.params.id, owner: req.user._id });
    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Log entry not found.',
      });
    }

    const playbook = resolveRemediationPlaybook(log);
    log.remediated = true;
    log.acknowledged = true;
    log.remediatedAt = new Date();
    log.remediationAction = playbook.action;
    log.remediationSummary = playbook.summary;
    await log.save();

    return res.status(200).json({
      success: true,
      log,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/logs/fix-all
 * Batch-remediates all open threat/anomaly entries for the authenticated user.
 */
async function fixAllIssues(req, res, next) {
  try {
    const openLogs = await LogEntry.find({
      owner: req.user._id,
      $or: [
        { isThreat: true, remediated: { $ne: true } },
        { isThreat: true, acknowledged: false },
      ],
    });

    if (openLogs.length === 0) {
      return res.status(200).json({
        success: true,
        fixedCount: 0,
        actionsApplied: [],
      });
    }

    const now = new Date();
    const actionSet = new Set();
    const bulkOps = openLogs.map((entry) => {
      const playbook = resolveRemediationPlaybook(entry);
      actionSet.add(playbook.action);
      return {
        updateOne: {
          filter: { _id: entry._id, owner: req.user._id },
          update: {
            $set: {
              remediated: true,
              acknowledged: true,
              remediatedAt: now,
              remediationAction: playbook.action,
              remediationSummary: playbook.summary,
            },
          },
        },
      };
    });

    await LogEntry.bulkWrite(bulkOps);

    return res.status(200).json({
      success: true,
      fixedCount: openLogs.length,
      actionsApplied: Array.from(actionSet),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/logs/:id/acknowledge
 */
async function acknowledgeThreat(req, res, next) {
  try {
    const log = await LogEntry.findOne({ _id: req.params.id, owner: req.user._id });
    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Log entry not found.',
      });
    }

    log.acknowledged =
      typeof req.body?.acknowledged === 'boolean' ? req.body.acknowledged : !log.acknowledged;
    await log.save();

    return res.status(200).json({
      success: true,
      log,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/logs/clear
 */
async function clearLogs(req, res, next) {
  try {
    const result = await LogEntry.deleteMany({ owner: req.user._id });
    return res.status(200).json({
      success: true,
      deletedCount: result.deletedCount || 0,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/logs/rules
 */
async function getRules(req, res, next) {
  try {
    const rules = await RegexRule.find({ createdBy: req.user._id }).sort({
      priority: 1,
      createdAt: -1,
    });
    return res.status(200).json({
      success: true,
      rules,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/logs/rules
 */
async function createRule(req, res, next) {
  try {
    const {
      name,
      sourceType,
      pattern,
      flags,
      description,
      sampleLine,
      severityOverride,
      isActive,
      priority,
    } = req.body || {};

    const safety = validateRegexSafety(pattern, flags || '');
    if (!safety.valid) {
      return res.status(400).json({
        success: false,
        message: safety.error,
      });
    }

    const rule = await RegexRule.create({
      name,
      sourceType: sourceType || 'custom',
      pattern,
      flags: flags || '',
      description: description || '',
      sampleLine: sampleLine || '',
      severityOverride: severityOverride || 'AUTO',
      isActive: typeof isActive === 'boolean' ? isActive : true,
      priority: Number(priority) || 50,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      rule,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * PUT /api/logs/rules/:id
 */
async function updateRule(req, res, next) {
  try {
    const rule = await RegexRule.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Regex rule not found.',
      });
    }

    const nextPattern = req.body?.pattern !== undefined ? req.body.pattern : rule.pattern;
    const nextFlags = req.body?.flags !== undefined ? req.body.flags : rule.flags;
    const safety = validateRegexSafety(nextPattern, nextFlags);

    if (!safety.valid) {
      return res.status(400).json({
        success: false,
        message: safety.error,
      });
    }

    const updatable = [
      'name',
      'sourceType',
      'pattern',
      'flags',
      'description',
      'sampleLine',
      'severityOverride',
      'isActive',
      'priority',
    ];

    for (const field of updatable) {
      if (req.body?.[field] !== undefined) {
        rule[field] = req.body[field];
      }
    }

    await rule.save();
    return res.status(200).json({
      success: true,
      rule,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/logs/rules/:id
 */
async function deleteRule(req, res, next) {
  try {
    const deleted = await RegexRule.findOneAndDelete({
      _id: req.params.id,
      createdBy: req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Regex rule not found.',
      });
    }

    return res.status(200).json({
      success: true,
      deletedId: deleted._id,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/logs/rules/test
 * Dry-run regex test endpoint for RegexTesterModal.
 */
async function testRule(req, res, next) {
  try {
    const { pattern, flags = '', sampleText, sampleLines } = req.body || {};

    let lines = [];
    if (Array.isArray(sampleLines)) {
      lines = sampleLines.map((l) => String(l)).filter(Boolean);
    } else if (typeof sampleText === 'string') {
      lines = sampleText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    }

    const testResult = testRegexPattern({ pattern, flags, sampleLines: lines });
    if (!testResult.valid) {
      return res.status(400).json({
        success: false,
        message: testResult.error,
      });
    }

    return res.status(200).json({
      success: true,
      ...testResult,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  ingestLogs,
  simulateLogs,
  probeUrl,
  getLogs,
  getThreats,
  acknowledgeThreat,
  fixIssue,
  fixAllIssues,
  clearLogs,
  getRules,
  createRule,
  updateRule,
  deleteRule,
  testRule,
};
