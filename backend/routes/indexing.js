// /Users/nashe/casa/backend/routes/indexing.js

const express = require('express');
const auth = require('../middleware/auth');
const chunker = require('../services/chunker');
const embeddings = require('../services/embeddings');
const vectorService = require('../services/vectorService');

const router = express.Router();

/**
 * POST /api/projects/:projectId/index
 * Body: { paths: string[] }
 * Indexes one or more files by chunking, embedding, and upserting into the vector DB.
 */
router.post('/:projectId/index', auth, async (req, res) => {
  try {
    const { paths } = req.body;
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: 'paths array required' });
    }

    for (const path of paths) {
      // 1) Chunk the file
      const chunks = await chunker.chunkFile(req.params.projectId, path);
      const texts = chunks.map((c) => c.text);

      // 2) Embed the chunks
      const vectorsValues = await embeddings.embed(texts);

      // 3) Prepare and upsert vectors
      const vectors = chunks.map((chunk, i) => ({
        id: `${path}#${i}`,
        values: vectorsValues[i],
        metadata: { path },
      }));
      await vectorService.upsertVectors(vectors);
    }

    res.json({ indexed: paths.length });
  } catch (err) {
    console.error('INDEXING ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
