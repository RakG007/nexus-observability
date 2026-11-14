const vm = require('vm');

const MAX_PATTERN_LENGTH = 500;
const MAX_LINE_LENGTH = 8192;
const REGEX_EXEC_TIMEOUT_MS = 50;

/**
 * Escapes user-provided literal search strings before constructing RegExp for DB queries.
 */
function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Performs static ReDoS hazard detection and syntax validation on user-supplied regex patterns.
 * Rejects nested unbounded quantifiers like (a+)+, (.*)*, ([a-z]+)* that cause catastrophic backtracking.
 * @param {string} pattern
 * @param {string} [flags='']
 * @returns {{ valid: boolean, error?: string }}
 */
function validateRegexSafety(pattern, flags = '') {
  if (typeof pattern !== 'string' || !pattern.trim()) {
    return { valid: false, error: 'Regex pattern must be a non-empty string.' };
  }

  if (pattern.length > MAX_PATTERN_LENGTH) {
    return {
      valid: false,
      error: `Regex pattern exceeds maximum allowed length of ${MAX_PATTERN_LENGTH} characters.`,
    };
  }

  if (!/^[gimsuvy]*$/.test(flags || '')) {
    return { valid: false, error: 'Regex flags contain unsupported flag characters.' };
  }

  // Detect nested unbounded quantifiers across parenthesized groups.
  const groupStack = [];
  let inCharClass = false;
  let escaped = false;

  const isUnboundedQuantifier = (str, idx) => {
    const ch = str[idx];
    if (ch === '+' || ch === '*') return { matched: true, endIdx: idx };
    if (ch === '{') {
      const slice = str.slice(idx);
      const braceMatch = slice.match(/^\{(\d+),(\d*)\}/);
      if (braceMatch && braceMatch[2] === '') {
        return { matched: true, endIdx: idx + braceMatch[0].length - 1 };
      }
    }
    return { matched: false, endIdx: idx };
  };

  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '[' && !inCharClass) {
      inCharClass = true;
      continue;
    }
    if (ch === ']' && inCharClass) {
      inCharClass = false;
      continue;
    }
    if (inCharClass) {
      continue;
    }

    if (ch === '(') {
      groupStack.push({ hasUnboundedInner: false });
      continue;
    }

    if (ch === ')') {
      const closedGroup = groupStack.pop();
      if (!closedGroup) continue;

      const outerQuant = isUnboundedQuantifier(pattern, i + 1);
      if (outerQuant.matched && closedGroup.hasUnboundedInner) {
        return {
          valid: false,
          error:
            'Unsafe regex rejected (potential ReDoS): nested unbounded quantifier inside a quantified group.',
        };
      }
      if (outerQuant.matched && groupStack.length > 0) {
        groupStack[groupStack.length - 1].hasUnboundedInner = true;
      }
      if (closedGroup.hasUnboundedInner && groupStack.length > 0) {
        groupStack[groupStack.length - 1].hasUnboundedInner = true;
      }
      continue;
    }

    const innerQuant = isUnboundedQuantifier(pattern, i);
    if (innerQuant.matched && groupStack.length > 0) {
      groupStack[groupStack.length - 1].hasUnboundedInner = true;
    }
  }

  try {
    // Strip 'g' for syntax validation consistency
    new RegExp(pattern, flags);
  } catch (err) {
    return { valid: false, error: `Invalid regular expression syntax: ${err.message}` };
  }

  return { valid: true };
}

/**
 * Executes a regex against a bounded input string inside a timeout-guarded VM context
 * to guarantee V8 cannot hang on pathological backtracking inputs.
 */
function execRegexSafely(pattern, flags, line, timeoutMs = REGEX_EXEC_TIMEOUT_MS) {
  const safeLine = String(line).slice(0, MAX_LINE_LENGTH);
  const safeFlags = (flags || '').replace(/g/g, '');

  const sandbox = {
    pattern,
    safeFlags,
    safeLine,
    result: null,
  };

  vm.runInNewContext(
    `
    const re = new RegExp(pattern, safeFlags);
    const m = re.exec(safeLine);
    if (m) {
      result = {
        matched: m[0],
        index: m.index,
        groups: m.groups ? Object.assign({}, m.groups) : {},
        captures: m.slice(1)
      };
    }
    `,
    sandbox,
    { timeout: timeoutMs }
  );

  return sandbox.result;
}

/**
 * Built-in default regex rules provisioned for new users and fallback parsing.
 */
function getDefaultRulesTemplates() {
  return [
    {
      name: 'Nginx Combined + Latency',
      sourceType: 'nginx',
      pattern:
        '^(?<ip>\\d{1,3}(?:\\.\\d{1,3}){3})\\s+\\S+\\s+(?<user>\\S+)\\s+\\[(?<timestamp>[^\\]]+)\\]\\s+"(?<method>[A-Z]+)\\s+(?<path>\\S+)[^"]*"\\s+(?<status>\\d{3})\\s+(?<bytes>\\d+|-)\\s+"[^"]*"\\s+"(?<userAgent>[^"]*)"(?:\\s+rt=(?<latency>\\d+(?:\\.\\d+)?)ms)?',
      flags: '',
      description: 'Parses Nginx combined access logs with optional upstream response time (rt=...ms).',
      sampleLine:
        '203.0.113.42 - - [12/Nov/2026:14:22:01 +0000] "GET /api/v1/users?id=42 HTTP/1.1" 200 1842 "-" "Mozilla/5.0" rt=18.4ms',
      severityOverride: 'AUTO',
      isActive: true,
      isDefault: true,
      priority: 10,
    },
    {
      name: 'Apache HTTP Combined',
      sourceType: 'apache',
      pattern:
        '^(?<ip>\\d{1,3}(?:\\.\\d{1,3}){3})\\s+\\S+\\s+(?<user>\\S+)\\s+\\[(?<timestamp>[^\\]]+)\\]\\s+"(?<method>[A-Z]+)\\s+(?<path>\\S+)[^"]*"\\s+(?<status>\\d{3})\\s+(?<bytes>\\d+|-)(?:\\s+"[^"]*"\\s+"(?<userAgent>[^"]*)")?',
      flags: '',
      description: 'Parses standard Apache HTTP Server common & combined access logs.',
      sampleLine:
        '198.51.100.14 - frank [12/Nov/2026:14:25:10 +0000] "POST /checkout/confirm HTTP/1.1" 502 532 "https://cipherlogiq.io" "curl/8.4.0"',
      severityOverride: 'AUTO',
      isActive: true,
      isDefault: true,
      priority: 20,
    },
    {
      name: 'Linux SSH / Auth Daemon',
      sourceType: 'auth',
      pattern:
        '^(?<timestamp>[A-Z][a-z]{2}\\s+\\d{1,2}\\s+\\d{2}:\\d{2}:\\d{2})\\s+(?<service>\\S+)\\s+sshd\\[\\d+\\]:\\s+(?<message>.*?from\\s+(?<ip>\\d{1,3}(?:\\.\\d{1,3}){3})\\s+port\\s+(?<port>\\d+).*)',
      flags: '',
      description: 'Extracts host, source IP, port, and auth status from Linux sshd syslog entries.',
      sampleLine:
        'Nov 12 14:26:03 prod-bastion-01 sshd[4821]: Failed password for invalid user admin from 185.220.101.44 port 54122 ssh2',
      severityOverride: 'AUTO',
      isActive: true,
      isDefault: true,
      priority: 30,
    },
    {
      name: 'Microservice API Telemetry',
      sourceType: 'api',
      pattern:
        '^(?<timestamp>\\d{4}-\\d{2}-\\d{2}T[\\d:.]+Z?)\\s+\\[(?<level>DEBUG|INFO|WARN|ERROR|CRITICAL)\\]\\s+service=(?<service>\\S+)\\s+method=(?<method>[A-Z]+)\\s+path=(?<path>\\S+)\\s+status=(?<status>\\d{3})\\s+latency=(?<latency>\\d+(?:\\.\\d+)?)ms\\s+ip=(?<ip>\\S+)(?:\\s+msg="(?<message>[^"]*)")?',
      flags: 'i',
      description: 'Parses structured key-value API gateway and microservice telemetry lines.',
      sampleLine:
        '2026-11-12T14:28:11.204Z [ERROR] service=payments-core method=POST path=/api/v1/charge status=500 latency=1842.5ms ip=10.24.8.19 msg="Upstream gateway timeout"',
      severityOverride: 'AUTO',
      isActive: true,
      isDefault: true,
      priority: 40,
    },
  ];
}

const THREAT_SIGNATURES = [
  {
    type: 'SQLI',
    score: 92,
    regex:
      /(\bunion\b[\s+]+(?:all[\s+]+)?select\b|\bor\b\s+1\s*=\s*1\b|'\s*or\s*'1'\s*=\s*'1|sleep\(\d+\)|benchmark\(|xp_cmdshell|information_schema|;\s*drop\s+table\b)/i,
  },
  {
    type: 'PATH_TRAVERSAL',
    score: 88,
    regex: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\/etc\/passwd|\/etc\/shadow|win\.ini)/i,
  },
  {
    type: 'XSS',
    score: 84,
    regex: /(<script\b|javascript:|onerror\s*=|onload\s*=|document\.cookie|<svg[^>]*onload)/i,
  },
  {
    type: 'BRUTE_FORCE',
    score: 78,
    regex:
      /(failed password|authentication failure|invalid user|too many authentication failures|brute.?force)/i,
  },
  {
    type: 'SCANNER',
    score: 74,
    regex:
      /(sqlmap|nikto|nmap|masscan|dirbuster|gobuster|\/\.env\b|\/wp-login\.php|\/phpmyadmin|\/\.git\/config)/i,
  },
];

function safePercentDecode(str) {
  return String(str).replace(/%([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  );
}

/**
 * Classifies security threats and operational anomalies from raw & extracted log attributes.
 */
function classifyThreat({ raw, path, userAgent, statusCode, latencyMs, source }) {
  const inspectionText = [raw, path, userAgent].filter(Boolean).join(' ');
  const decodedText = safePercentDecode(inspectionText);

  for (const sig of THREAT_SIGNATURES) {
    if (sig.regex.test(inspectionText) || sig.regex.test(decodedText)) {
      return {
        isThreat: true,
        threatType: sig.type,
        threatScore: sig.score,
      };
    }
  }

  // Repeated or sensitive auth endpoint failures
  if (
    (statusCode === 401 || statusCode === 403 || statusCode === 429) &&
    path &&
    /\/(login|auth|token|admin|oauth)/i.test(path)
  ) {
    return {
      isThreat: true,
      threatType: 'BRUTE_FORCE',
      threatScore: statusCode === 429 ? 76 : 68,
    };
  }

  if (source === 'auth' && /failed|denied|unauthorized|invalid/i.test(raw)) {
    return {
      isThreat: true,
      threatType: 'BRUTE_FORCE',
      threatScore: 76,
    };
  }

  if (statusCode && statusCode >= 500) {
    return {
      isThreat: true,
      threatType: 'SERVER_ERROR',
      threatScore: statusCode === 503 || statusCode === 502 ? 70 : 65,
    };
  }

  if (typeof latencyMs === 'number' && latencyMs >= 1500) {
    return {
      isThreat: true,
      threatType: 'ANOMALY',
      threatScore: 55,
    };
  }

  return {
    isThreat: false,
    threatType: 'NONE',
    threatScore: 0,
  };
}

/**
 * Normalizes log timestamp strings (ISO, Apache/Nginx CLF, Syslog) safely.
 */
function parseTimestamp(rawTs) {
  if (!rawTs) return new Date();
  // CLF format: 12/Nov/2026:14:22:01 +0000
  const clfMatch = String(rawTs).match(
    /^(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}:\d{2}:\d{2})\s*([+-]\d{4})?$/
  );
  if (clfMatch) {
    const [, day, mon, year, time, tz] = clfMatch;
    const parsed = new Date(`${day} ${mon} ${year} ${time} ${tz || 'UTC'}`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  // Syslog format: Nov 12 14:26:03
  const sysMatch = String(rawTs).match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})$/);
  if (sysMatch) {
    const year = new Date().getFullYear();
    const parsed = new Date(`${sysMatch[1]} ${sysMatch[2]} ${year} ${sysMatch[3]}`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const direct = new Date(rawTs);
  return Number.isNaN(direct.getTime()) ? new Date() : direct;
}

/**
 * Determines log severity level from status, threat score, and explicit level tags.
 */
function deriveLevel({ explicitLevel, statusCode, threatScore, severityOverride }) {
  if (severityOverride && severityOverride !== 'AUTO') {
    return severityOverride;
  }
  if (explicitLevel) {
    const upper = String(explicitLevel).toUpperCase();
    if (upper === 'CRITICAL' || upper === 'FATAL') return 'CRITICAL';
    if (upper === 'ERROR' || upper === 'ERR') return 'ERROR';
    if (upper === 'WARN' || upper === 'WARNING') return 'WARN';
  }
  if (threatScore >= 85) return 'CRITICAL';
  if ((statusCode && statusCode >= 500) || threatScore >= 65) return 'ERROR';
  if ((statusCode && statusCode >= 400) || threatScore >= 40) return 'WARN';
  return 'INFO';
}

/**
 * Parses a single raw log line against ordered RegexRules, with heuristic fallback.
 */
function parseLogLine(rawLine, rules = [], options = {}) {
  const raw = String(rawLine || '').trim().slice(0, MAX_LINE_LENGTH);
  const sortedRules = [...rules]
    .filter((r) => r.isActive !== false)
    .sort((a, b) => (a.priority ?? 50) - (b.priority ?? 50));

  let matchedRule = null;
  let execMatch = null;

  for (const rule of sortedRules) {
    try {
      const check = validateRegexSafety(rule.pattern, rule.flags);
      if (!check.valid) continue;
      const res = execRegexSafely(rule.pattern, rule.flags, raw);
      if (res) {
        matchedRule = rule;
        execMatch = res;
        break;
      }
    } catch {
      // Skip timed-out or malformed rule cleanly so pipeline never stalls.
      continue;
    }
  }

  const groups = execMatch?.groups || {};
  const statusRaw = groups.status || groups.statusCode;
  const statusCode = statusRaw && /^\d{3}$/.test(String(statusRaw)) ? Number(statusRaw) : null;
  const latencyRaw = groups.latency || groups.latencyMs;
  const latencyMs =
    latencyRaw !== undefined && latencyRaw !== null && !Number.isNaN(Number(latencyRaw))
      ? Number(latencyRaw)
      : null;

  // Heuristic IP extraction if not matched by named group
  const fallbackIp = raw.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/)?.[1] || null;
  const ip = groups.ip || fallbackIp;
  const method = groups.method ? String(groups.method).toUpperCase() : null;
  const path = groups.path || null;
  const userAgent = groups.userAgent || null;
  const service =
    groups.service ||
    (matchedRule?.sourceType === 'nginx'
      ? 'nginx-ingress'
      : matchedRule?.sourceType === 'apache'
        ? 'apache-httpd'
        : matchedRule?.sourceType === 'auth'
          ? 'sshd-auth'
          : 'api-gateway');

  const source = options.sourceOverride || matchedRule?.sourceType || 'custom';
  const threat = classifyThreat({
    raw,
    path,
    userAgent,
    statusCode,
    latencyMs,
    source,
  });

  const level = deriveLevel({
    explicitLevel: groups.level,
    statusCode,
    threatScore: threat.threatScore,
    severityOverride: matchedRule?.severityOverride,
  });

  const timestamp = options.preserveTimestamp === false ? new Date() : parseTimestamp(groups.timestamp);

  return {
    source,
    raw,
    timestamp,
    level,
    method,
    path,
    statusCode,
    ip,
    latencyMs,
    userAgent,
    service,
    matchedRuleName: matchedRule ? matchedRule.name : 'Unmatched / Heuristic',
    matchedRuleId: matchedRule?._id || null,
    parsedFields: {
      ...groups,
      ...(execMatch?.captures?.length && Object.keys(groups).length === 0
        ? { captures: execMatch.captures }
        : {}),
    },
    isThreat: threat.isThreat,
    threatType: threat.threatType,
    threatScore: threat.threatScore,
  };
}

/**
 * Dry-run tester for RegexTesterModal: tests a pattern against sample lines without DB writes.
 */
function testRegexPattern({ pattern, flags = '', sampleLines = [] }) {
  const safety = validateRegexSafety(pattern, flags);
  if (!safety.valid) {
    return { valid: false, error: safety.error, results: [] };
  }

  const lines = Array.isArray(sampleLines) ? sampleLines.slice(0, 50) : [String(sampleLines || '')];
  const results = lines.map((line) => {
    const startNs = process.hrtime.bigint();
    try {
      const exec = execRegexSafely(pattern, flags, line);
      const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1e6;

      if (!exec) {
        return {
          line,
          matched: false,
          executionMs: Number(elapsedMs.toFixed(3)),
          groups: {},
          captures: [],
          threat: classifyThreat({ raw: line, source: 'custom' }),
        };
      }

      const groups = exec.groups || {};
      const statusCode = groups.status ? Number(groups.status) : null;
      const latencyMs = groups.latency ? Number(groups.latency) : null;

      return {
        line,
        matched: true,
        matchedSegment: exec.matched,
        matchIndex: exec.index,
        executionMs: Number(elapsedMs.toFixed(3)),
        groups,
        captures: exec.captures || [],
        threat: classifyThreat({
          raw: line,
          path: groups.path,
          userAgent: groups.userAgent,
          statusCode: Number.isNaN(statusCode) ? null : statusCode,
          latencyMs: Number.isNaN(latencyMs) ? null : latencyMs,
          source: 'custom',
        }),
      };
    } catch (err) {
      const elapsedMs = Number(process.hrtime.bigint() - startNs) / 1e6;
      return {
        line,
        matched: false,
        timedOut: /timed out/i.test(err.message),
        error: err.message,
        executionMs: Number(elapsedMs.toFixed(3)),
        groups: {},
        captures: [],
      };
    }
  });

  return { valid: true, results };
}

module.exports = {
  escapeRegExp,
  validateRegexSafety,
  execRegexSafely,
  getDefaultRulesTemplates,
  classifyThreat,
  parseLogLine,
  testRegexPattern,
};
