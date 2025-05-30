// backend/routes/chunk.js
const express       = require('express');
const auth          = require('../middleware/auth');
const fileService   = require('../services/fileService');
const { chunkText } = require('../services/chunker');
const { convertPdfToMmd } = require('../services/mathpixService');

const router      = express.Router();
const USE_MATHPIX = process.env.USE_MATHPIX === 'true';

/**
 * GET /api/projects/:projectId/chunk
 * Query params: path, chunkSize, overlap
 * Caches chunks in S3 under "<projectId>/<path>.chunks.json".
 */
router.get('/:projectId/chunk', auth, async (req, res) => {
  try {
    const {
      path,
      chunkSize = 1800,          // ★ new default
      overlap   = 200            // ★ new default
    } = req.query;
    const projectId = req.params.projectId;

    const cacheKey = `${projectId}/${path}.chunks.json`;

    /* 1) Try cached chunks */
    try {
      const buf = await fileService.read(cacheKey);
      const cached = JSON.parse(buf.toString('utf-8'));
      return res.json({ chunks: cached.chunks });
    } catch { /* cache miss */ }

    /* 2) Read file from S3 */
    const fileKey = `${projectId}/${path}`;
    const buffer  = await fileService.read(fileKey);

    /* 3) Extract text */
    let text;
    if (USE_MATHPIX && path.toLowerCase().endsWith('.pdf')) {
      text = await convertPdfToMmd(buffer);
    } else {
      text = buffer.toString('utf-8');
    }

    /* 4) Chunk text */
    const rawChunks = chunkText(text, {
      chunkSize: Number(chunkSize),
      overlap:   Number(overlap),
    });

    /* 5) Format chunks */
    const chunks = rawChunks.map(c => ({
      id:     `${path}::${c.id}`,
      text:   c.text,
      source: path,
    }));

    /* 6) Cache */
    await fileService.write(
      cacheKey,
      Buffer.from(JSON.stringify({ chunks }), 'utf-8')
    );

    return res.json({ chunks });
  } catch (err) {
    console.error('CHUNK ERROR', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
