const LogEntry = require('../models/LogEntry');

const WINDOW_CONFIG = {
  '1h': { durationMs: 60 * 60 * 1000, bucketMs: 5 * 60 * 1000, minutes: 60 },
  '24h': { durationMs: 24 * 60 * 60 * 1000, bucketMs: 60 * 60 * 1000, minutes: 1440 },
  '7d': { durationMs: 7 * 24 * 60 * 60 * 1000, bucketMs: 24 * 60 * 60 * 1000, minutes: 10080 },
};

/**
 * Computes P95 latency from a numeric array.
 */
function calculateP95(values) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  return Math.round(sorted[index] * 10) / 10;
}

/**
 * GET /api/analytics/overview?window=1h|24h|7d
 * Aggregates KPI metrics, time-series traffic/error/latency buckets, status distribution,
 * source breakdown, top endpoints, and top threat IPs in a single $facet pipeline.
 */
async function getOverview(req, res, next) {
  try {
    const windowKey = WINDOW_CONFIG[req.query.window] ? req.query.window : '24h';
    const { durationMs, bucketMs, minutes } = WINDOW_CONFIG[windowKey];
    const since = new Date(Date.now() - durationMs);

    const [[agg], recentLatencies] = await Promise.all([
      LogEntry.aggregate([
        {
          $match: {
            owner: req.user._id,
            timestamp: { $gte: since },
          },
        },
        {
          $facet: {
            kpis: [
              {
                $group: {
                  _id: null,
                  totalLogs: { $sum: 1 },
                  errorCount: {
                    $sum: { $cond: [{ $in: ['$level', ['ERROR', 'CRITICAL']] }, 1, 0] },
                  },
                  warnCount: {
                    $sum: { $cond: [{ $eq: ['$level', 'WARN'] }, 1, 0] },
                  },
                  threatCount: {
                    $sum: { $cond: [{ $eq: ['$isThreat', true] }, 1, 0] },
                  },
                  unacknowledgedThreats: {
                    $sum: {
                      $cond: [
                        { $and: [{ $eq: ['$isThreat', true] }, { $eq: ['$acknowledged', false] }] },
                        1,
                        0,
                      ],
                    },
                  },
                  remediatedThreats: {
                    $sum: {
                      $cond: [
                        { $and: [{ $eq: ['$isThreat', true] }, { $eq: ['$remediated', true] }] },
                        1,
                        0,
                      ],
                    },
                  },
                  avgLatencyMs: { $avg: '$latencyMs' },
                },
              },
            ],
            timeSeries: [
            {
              $addFields: {
                bucketEpoch: {
                  $subtract: [
                    { $toLong: '$timestamp' },
                    { $mod: [{ $toLong: '$timestamp' }, bucketMs] },
                  ],
                },
              },
            },
            {
              $group: {
                _id: '$bucketEpoch',
                total: { $sum: 1 },
                errors: {
                  $sum: { $cond: [{ $in: ['$level', ['ERROR', 'CRITICAL']] }, 1, 0] },
                },
                threats: {
                  $sum: { $cond: [{ $eq: ['$isThreat', true] }, 1, 0] },
                },
                avgLatencyMs: { $avg: '$latencyMs' },
              },
            },
            { $sort: { _id: 1 } },
          ],
          statusDistribution: [
            { $match: { statusCode: { $ne: null } } },
            {
              $group: {
                _id: {
                  $switch: {
                    branches: [
                      { case: { $lt: ['$statusCode', 300] }, then: '2xx' },
                      { case: { $lt: ['$statusCode', 400] }, then: '3xx' },
                      { case: { $lt: ['$statusCode', 500] }, then: '4xx' },
                    ],
                    default: '5xx',
                  },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          sourceBreakdown: [
            { $group: { _id: '$source', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
          ],
          topEndpoints: [
            { $match: { path: { $ne: null } } },
            {
              $group: {
                _id: '$path',
                requests: { $sum: 1 },
                errors: {
                  $sum: { $cond: [{ $in: ['$level', ['ERROR', 'CRITICAL']] }, 1, 0] },
                },
                avgLatencyMs: { $avg: '$latencyMs' },
              },
            },
            { $sort: { requests: -1 } },
            { $limit: 8 },
          ],
          topThreatIPs: [
            { $match: { isThreat: true, ip: { $ne: null } } },
            {
              $group: {
                _id: '$ip',
                count: { $sum: 1 },
                maxScore: { $max: '$threatScore' },
                types: { $addToSet: '$threatType' },
              },
            },
            { $sort: { count: -1, maxScore: -1 } },
            { $limit: 6 },
          ],
            threatBreakdown: [
              { $match: { isThreat: true } },
              { $group: { _id: '$threatType', count: { $sum: 1 } } },
              { $sort: { count: -1 } },
            ],
          },
        },
      ]),
      // Bounded sample of recent latencies prevents 16MB BSON $group overflow at scale.
      LogEntry.find({
        owner: req.user._id,
        timestamp: { $gte: since },
        latencyMs: { $ne: null },
      })
        .select('latencyMs -_id')
        .sort({ timestamp: -1 })
        .limit(2000)
        .lean(),
    ]);

    const rawKpis = agg?.kpis?.[0] || {
      totalLogs: 0,
      errorCount: 0,
      warnCount: 0,
      threatCount: 0,
      unacknowledgedThreats: 0,
      avgLatencyMs: 0,
    };

    const numericLatencies = recentLatencies
      .map((doc) => doc.latencyMs)
      .filter((v) => typeof v === 'number' && !Number.isNaN(v));
    const totalLogs = rawKpis.totalLogs || 0;
    const errorRate = totalLogs > 0 ? Number(((rawKpis.errorCount / totalLogs) * 100).toFixed(2)) : 0;

    return res.status(200).json({
      success: true,
      window: windowKey,
      kpis: {
        totalLogs,
        errorCount: rawKpis.errorCount || 0,
        warnCount: rawKpis.warnCount || 0,
        errorRate,
        threatCount: rawKpis.threatCount || 0,
        unacknowledgedThreats: rawKpis.unacknowledgedThreats || 0,
        remediatedThreats: rawKpis.remediatedThreats || 0,
        avgLatencyMs: rawKpis.avgLatencyMs ? Number(rawKpis.avgLatencyMs.toFixed(1)) : 0,
        p95LatencyMs: calculateP95(numericLatencies),
        requestsPerMinute: Number((totalLogs / minutes).toFixed(2)),
      },
      timeSeries: (agg?.timeSeries || []).map((b) => ({
        timestamp: new Date(b._id).toISOString(),
        label:
          windowKey === '7d'
            ? new Date(b._id).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : new Date(b._id).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }),
        total: b.total,
        errors: b.errors,
        threats: b.threats,
        avgLatencyMs: b.avgLatencyMs ? Number(b.avgLatencyMs.toFixed(1)) : 0,
      })),
      statusDistribution: (agg?.statusDistribution || []).map((s) => ({
        bucket: s._id,
        count: s.count,
      })),
      sourceBreakdown: (agg?.sourceBreakdown || []).map((s) => ({
        source: s._id,
        count: s.count,
      })),
      topEndpoints: (agg?.topEndpoints || []).map((e) => ({
        path: e._id,
        requests: e.requests,
        errors: e.errors,
        avgLatencyMs: e.avgLatencyMs ? Number(e.avgLatencyMs.toFixed(1)) : 0,
      })),
      topThreatIPs: (agg?.topThreatIPs || []).map((t) => ({
        ip: t._id,
        count: t.count,
        maxScore: t.maxScore,
        types: t.types,
      })),
      threatBreakdown: (agg?.threatBreakdown || []).map((t) => ({
        threatType: t._id,
        count: t.count,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getOverview };
