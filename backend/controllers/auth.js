const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Donation = require('../models/Donation');

const SESSION_MAX_AGE = 10 * 24 * 60 * 60 * 1000;

function safeUser(user) {
  return {
    id: String(user._id),
    fullName: user.fullName,
    occupation: user.occupation || '',
    address: user.address,
    email: user.email,
    preferredRole: user.preferredRole || 'DONOR'
  };
}

function cleanRole(value) {
  return value === 'VOLUNTEER' ? 'VOLUNTEER' : 'DONOR';
}

async function startSession(req, user) {
  await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
  req.session.userId = String(user._id);
  req.session.loginAt = Date.now();
  req.session.cookie.maxAge = SESSION_MAX_AGE;
  await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
}

exports.register = async (req, res, next) => {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const occupation = String(req.body.occupation || '').trim();
    const address = String(req.body.address || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (fullName.length < 2 || fullName.length > 100) return res.status(400).json({ message: 'Enter your full name (2–100 characters).' });
    if (occupation.length < 2 || occupation.length > 100) return res.status(400).json({ message: 'Enter your occupation (2–100 characters).' });
    if (address.length < 5 || address.length > 500) return res.status(400).json({ message: 'Enter a complete address (5–500 characters).' });
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email ID.' });
    if (password.length < 8 || password.length > 128) return res.status(400).json({ message: 'Password must be between 8 and 128 characters.' });
    if (await User.findOne({ email }).select('_id')) return res.status(409).json({ message: 'An account with this email already exists. Please log in.' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ fullName, occupation, address, email, passwordHash, preferredRole: cleanRole(req.body.preferredRole) });
    await startSession(req, user);
    return res.status(201).json({ message: 'Account created successfully.', user: safeUser(user) });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists. Please log in.' });
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ message: 'Enter your email ID and password.' });
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Incorrect email ID or password.' });
    }
    user.lastLoginAt = new Date();
    await user.save();
    await startSession(req, user);
    return res.json({ message: 'Login successful.', user: safeUser(user) });
  } catch (error) { next(error); }
};

exports.me = async (req, res, next) => {
  try {
    if (!req.session.userId) return res.status(401).json({ message: 'Please log in.' });
    const user = await User.findById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    req.session.touch();
    res.json({ user: safeUser(user) });
  } catch (error) { next(error); }
};

exports.history = async (req, res, next) => {
  try {
    if (!req.session.userId) return res.status(401).json({ message: 'Please log in.' });
    const userId = req.session.userId;
    const [donated, served] = await Promise.all([
      Donation.find({ donor: userId }).sort({ createdAt: -1 }).limit(200).lean(),
      Donation.find({ $or: [{ acceptedBy: userId }, { acceptedUsers: userId }] }).populate('donor', 'fullName').sort({ acceptedAt: -1, updatedAt: -1 }).limit(200).lean()
    ]);
    const serialize = item => ({
      id: String(item._id), title: item.title, category: item.category, quantity: item.quantity,
      state: item.state || 'Maharashtra', city: item.city, area: item.area || '', status: item.sevaProgress?.find(entry => String(entry.user) === String(userId))?.status || item.status, createdAt: item.createdAt,
      acceptedAt: item.acceptedAt || null, donorName: item.donor && item.donor.fullName ? item.donor.fullName : ''
    });
    res.json({ donated: donated.map(serialize), served: served.map(serialize), totals: {
      donations: donated.length,
      sevaAccepted: served.length,
      sevaCompleted: served.filter(item => ['COMPLETED', 'DELIVERED', 'COLLECTED'].includes(item.sevaProgress?.find(entry => String(entry.user) === String(userId))?.status || item.status)).length
    } });
  } catch (error) { next(error); }
};

exports.logout = (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);
    res.clearCookie('annasetu.sid', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
    res.json({ message: 'Logged out.' });
  });
};

exports.requireAuth = async (req, res, next) => {
  try {
    if (!req.session.userId) return res.status(401).json({ message: 'Please log in to continue.' });
    const user = await User.findById(req.session.userId);
    if (!user) return res.status(401).json({ message: 'Please log in to continue.' });
    req.user = user;
    next();
  } catch (error) { next(error); }
};
