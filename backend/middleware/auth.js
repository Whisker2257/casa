// /Users/nashe/casa/backend/middleware/auth.js

const jwt  = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function (req, res, next) {
  // Allow token via Authorization header or ?token= in the URL
  const authHeader =
    req.headers.authorization ||
    (req.query.token ? `Bearer ${req.query.token}` : '');
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;

  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) throw new Error('User not found');
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
