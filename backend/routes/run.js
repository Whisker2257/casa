// /Users/nashe/casa/backend/routes/run.js
require('dotenv').config();
const express     = require('express');
const auth        = require('../middleware/auth');
const fileService = require('../services/fileService');
const { spawn }   = require('child_process');

const router = express.Router();

/**
 * POST /api/projects/:projectId/run
 * Streams stdout/stderr of python3 -u, fed the file contents via stdin.
 * Body: { path: 'relative/path.py' }
 */
router.post('/:projectId/run', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { path }      = req.body;
    if (!path) {
      return res.status(400).json({ error: 'Path required' });
    }

    // Read code from storage
    const key = `${projectId}/${path}`.replace(/^\/+/, '');
    const buf = await fileService.read(key);

    // Stream back as plain text
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');

    // Spawn python3 in unbuffered (-u) mode
    const py = spawn('python3', ['-u'], { stdio: ['pipe','pipe','pipe'] });

    py.stdout.on('data', chunk => res.write(chunk));
    py.stderr.on('data', chunk => res.write(chunk));
    py.on('close', code => res.end(`\n[Process exited with code ${code}]`));

    // Feed the code to Python stdin
    py.stdin.write(buf);
    py.stdin.end();
  } catch (err) {
    console.error('Run error:', err);
    res.status(500).send(err.message || 'Error running code');
  }
});

module.exports = router;
