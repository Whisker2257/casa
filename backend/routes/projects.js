// /Users/nashe/casa/backend/routes/projects.js
const router  = require('express').Router();
const auth    = require('../middleware/auth');
const Project = require('../models/Project');

/* all routes here require auth */
router.use(auth);

/* ───── List projects ───── */
router.get('/', async (req, res) => {
  const projects = await Project.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json({ projects });
});

/* ───── Create project ───── */
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  const project = await Project.create({ name, user: req.user._id });
  res.json({ project });
});

/* ───── Get single project (ownership enforced) ───── */
router.get('/:id', async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, user: req.user._id });
  if (!project) return res.status(404).json({ error: 'Not found' });
  res.json({ project });
});

module.exports = router;
