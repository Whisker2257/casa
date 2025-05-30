// /Users/nashe/casa/backend/routes/auth.js
require('dotenv').config();  // ensure .env is loaded here too
const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');

console.log('🔐 Auth routes loaded; JWT_SECRET present:', !!process.env.JWT_SECRET);

/* helper */
const signToken = id =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

/* ───── Signup ───── */
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const user  = await User.create({ name, email, password });
    const token = signToken(user._id);

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('SIGNUP ERROR:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

/* ───── Login ───── */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user._id);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

module.exports = router;
