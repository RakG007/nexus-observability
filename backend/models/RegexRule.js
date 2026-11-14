const mongoose = require('mongoose');

const regexRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Rule name is required'],
      trim: true,
      maxlength: [100, 'Rule name cannot exceed 100 characters'],
    },
    sourceType: {
      type: String,
      enum: ['nginx', 'apache', 'auth', 'api', 'custom'],
      default: 'custom',
    },
    pattern: {
      type: String,
      required: [true, 'Regex pattern is required'],
      maxlength: [500, 'Regex pattern cannot exceed 500 characters'],
    },
    flags: {
      type: String,
      default: '',
      maxlength: [6, 'Regex flags cannot exceed 6 characters'],
      match: [/^[gimsuvy]*$/, 'Invalid regex flags'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [300, 'Description cannot exceed 300 characters'],
    },
    sampleLine: {
      type: String,
      default: '',
      maxlength: [2000, 'Sample line cannot exceed 2000 characters'],
    },
    severityOverride: {
      type: String,
      enum: ['AUTO', 'INFO', 'WARN', 'ERROR', 'CRITICAL'],
      default: 'AUTO',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    priority: {
      type: Number,
      default: 50,
      min: 1,
      max: 1000,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
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

regexRuleSchema.index({ createdBy: 1, isActive: 1, priority: 1 });

module.exports = mongoose.model('RegexRule', regexRuleSchema);
