// /Users/nashe/casa/backend/routes/patch.js
const express     = require('express');
const auth        = require('../middleware/auth');
const fileService = require('../services/fileService');

const router = express.Router();

console.log('📦  patchRoutes loaded'); // <-- will print on server start

/**
 * Generate in-memory patches
 */
router.post('/:projectId/patches', auth, async (req, res) => {
  console.log('🔍  [PATCH] generate:', req.params.projectId, req.body.edits);
  try {
    const { edits } = req.body;
    if (!Array.isArray(edits)) {
      return res.status(400).json({ error: 'edits array required' });
    }
    const patches = [];
    for (const { path, search, replace } of edits) {
      const key = `${req.params.projectId}/${path}`.replace(/^\/+/, '');
      let buf;
      try {
        buf = await fileService.read(key);
      } catch (readErr) {
        console.error('PATCH ERROR reading key', key, readErr);
        return res
          .status(500)
          .json({ error: `Could not read key "${key}": ${readErr.message}` });
      }
      const before = buf.toString('utf8');
      const after  = before.split(search).join(replace);
      patches.push({ path, before, after });
    }
    return res.json({ patches });
  } catch (err) {
    console.error('PATCH ERROR', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Persist a single patch
 */
router.post('/:projectId/patches/apply', auth, async (req, res) => {
  console.log('💾  [PATCH] apply:', req.params.projectId, req.body.path);
  try {
    const { path, content } = req.body;
    if (typeof path !== 'string' || typeof content !== 'string') {
      return res.status(400).json({ error: 'path and content strings required' });
    }
    const key = `${req.params.projectId}/${path}`.replace(/^\/+/, '');
    await fileService.write(key, Buffer.from(content, 'utf8'));
    return res.json({ message: 'Patch applied', path });
  } catch (err) {
    console.error('APPLY PATCH ERROR', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
