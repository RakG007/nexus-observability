const User = require('../models/User');
const RegexRule = require('../models/RegexRule');
const LogEntry = require('../models/LogEntry');
const { signToken } = require('../middleware/authMiddleware');
const { getDefaultRulesTemplates, parseLogLine } = require('../utils/regexParser');
const { generateSampleBatch } = require('../utils/sampleLogs');

/**
 * Ensures a user has default regex parsing rules provisioned.
 */
async function ensureDefaultRules(userId) {
  const existingCount = await RegexRule.countDocuments({ createdBy: userId });
  if (existingCount === 0) {
    const templates = getDefaultRulesTemplates().map((rule) => ({
      ...rule,
      createdBy: userId,
    }));
    return RegexRule.insertMany(templates);
  }
  return RegexRule.find({ createdBy: userId }).sort({ priority: 1 });
}

/**
 * POST /api/auth/register
 */
async function register(req, res, next) {
  try {
    const { name, email, password, organization } = req.body || {};

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.',
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      organization: organization ? String(organization).trim() : 'Cipher Logiq',
      role: 'analyst',
    });

    // Provision default RegexRules and seed initial realistic telemetry
    const rules = await ensureDefaultRules(user._id);
    const initialSamples = generateSampleBatch(24, 0.25, 90);
    const parsedLogs = initialSamples.map((item) => ({
      ...parseLogLine(item.raw, rules, { sourceOverride: item.source }),
      owner: user._id,
    }));
    await LogEntry.insertMany(parsedLogs);

    const token = signToken(user);
    return res.status(201).json({
      success: true,
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    await ensureDefaultRules(user._id);
    const token = signToken(user);

    return res.status(200).json({
      success: true,
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/auth/me
 */
async function getMe(req, res) {
  return res.status(200).json({
    success: true,
    user: req.user.toJSON(),
  });
}

module.exports = { register, login, getMe, ensureDefaultRules };
