const mongoose = require('mongoose');

const logEntrySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['nginx', 'apache', 'auth', 'api', 'custom'],
      default: 'custom',
      index: true,
    },
    raw: {
      type: String,
      required: [true, 'Raw log line is required'],
      maxlength: [8192, 'Raw log line cannot exceed 8192 characters'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    level: {
      type: String,
      enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL'],
      default: 'INFO',
      index: true,
    },
    method: {
      type: String,
      default: null,
      maxlength: 16,
    },
    path: {
      type: String,
      default: null,
      maxlength: 2048,
    },
    statusCode: {
      type: Number,
      default: null,
      index: true,
    },
    ip: {
      type: String,
      default: null,
      maxlength: 64,
      index: true,
    },
    latencyMs: {
      type: Number,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
      maxlength: 512,
    },
    service: {
      type: String,
      default: 'edge-gateway',
      maxlength: 100,
    },
    matchedRuleName: {
      type: String,
      default: 'Unmatched / Heuristic',
    },
    matchedRuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RegexRule',
      default: null,
    },
    parsedFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    isThreat: {
      type: Boolean,
      default: false,
      index: true,
    },
    threatType: {
      type: String,
      enum: [
        'NONE',
        'SQLI',
        'XSS',
        'PATH_TRAVERSAL',
        'BRUTE_FORCE',
        'SCANNER',
        'SERVER_ERROR',
        'ANOMALY',
      ],
      default: 'NONE',
      index: true,
    },
    threatScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    acknowledged: {
      type: Boolean,
      default: false,
      index: true,
    },
    remediated: {
      type: Boolean,
      default: false,
      index: true,
    },
    remediatedAt: {
      type: Date,
      default: null,
    },
    remediationAction: {
      type: String,
      default: null,
      maxlength: 100,
    },
    remediationSummary: {
      type: String,
      default: null,
      maxlength: 300,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

logEntrySchema.index({ owner: 1, timestamp: -1 });
logEntrySchema.index({ owner: 1, isThreat: 1, acknowledged: 1, timestamp: -1 });
logEntrySchema.index({ owner: 1, level: 1, timestamp: -1 });
logEntrySchema.index({ owner: 1, source: 1, timestamp: -1 });

module.exports = mongoose.model('LogEntry', logEntrySchema);
