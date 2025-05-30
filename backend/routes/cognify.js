// backend/routes/cognify.js
/**
 * ─────────────────────────────────────────────────────────────
 *  Cognify Routes
 *  • POST /api/projects/:projectId/cognify      → index a single file
 *  • GET  /api/projects/:projectId/cognified    → list files already indexed
 * ─────────────────────────────────────────────────────────────
 */

 require('dotenv').config();

 const express             = require('express');
 const auth                = require('../middleware/auth');
 const fileService         = require('../services/fileService');
 const { convertPdfToMmd } = require('../services/mathpixService');
 const { chunkText }       = require('../services/chunker');
 const embeddings          = require('../services/embeddings');
 const vectorService       = require('../services/vectorService');
 
 const router      = express.Router();
 const USE_MATHPIX = process.env.USE_MATHPIX === 'true';
 
 /* ─────────────────────────────────────────────────────────────
    GET /api/projects/:projectId/cognified
    Return relative file paths that already have cached chunks
    ( *.chunks.json ) so UI can show “View Chunks”.
    ───────────────────────────────────────────────────────────── */
 router.get('/:projectId/cognified', auth, async (req, res) => {
   try {
     const prefix  = `${req.params.projectId}/`;
     const objects = await fileService.listAll(prefix, true); // includeCache = true
 
     const paths = objects
       .filter(obj => obj.path.endsWith('.chunks.json'))
       .map(obj =>
         obj.path
           .replace(prefix, '')            // strip "projectId/"
           .replace(/\.chunks\.json$/, '')  // drop suffix
       );
 
     res.json({ paths });
   } catch (err) {
     console.error('COGNIFIED-LIST ERROR:', err);
     res.status(500).json({ error: err.message || 'Could not list cognified files' });
   }
 });
 
 /* ─────────────────────────────────────────────────────────────
    POST /api/projects/:projectId/cognify
    Body: { path: 'relative/file.ext' }
 
    Streams status lines while:
      1) Extracting text
      2) Chunking  (★ now 1 800 char / 200 overlap)
      3) Embeddings
      4) Upserting to vector store
    ───────────────────────────────────────────────────────────── */
 router.post('/:projectId/cognify', auth, async (req, res) => {
   res.setHeader('Content-Type',  'text/plain; charset=UTF-8');
   res.setHeader('Cache-Control', 'no-cache, no-transform');
   res.setHeader('X-Accel-Buffering', 'no');          // disable Nginx buffering
 
   try {
     const { path } = req.body;
     if (!path) { res.write('❌ Error: "path" is required\n'); return res.end(); }
 
     const projectId = req.params.projectId;
     const cacheKey  = `${projectId}/${path}.chunks.json`;
 
     /* ------ 1. Extract text ------------------------------------------------ */
     res.write('🔍 Extracting text…\n');
     const fileKey = `${projectId}/${path}`.replace(/^\/+/, '');
     const buffer  = await fileService.read(fileKey);
 
     let text;
     if (USE_MATHPIX && path.toLowerCase().endsWith('.pdf')) {
       text = await convertPdfToMmd(buffer);
     } else {
       text = buffer.toString('utf-8');
     }
     res.write('✅ Text extracted\n');
 
     /* ------ 2. Load cache or chunk ---------------------------------------- */
     let chunks;
     try {
       res.write('⏳ Checking chunk cache…\n');
       const buf = await fileService.read(cacheKey);
       chunks = JSON.parse(buf.toString('utf-8')).chunks;
       res.write(`✅ Loaded ${chunks.length} cached chunks\n`);
     } catch {
       res.write('✂️ Chunking text…\n');
       const raw = chunkText(text, { chunkSize: 1800, overlap: 200 });   // ★ new defaults
       chunks = raw.map(c => ({
         id:     `${path}::${c.id}`,
         text:   c.text,
         source: path,
       }));
       res.write(`✅ ${chunks.length} chunks created\n`);
 
       res.write('💾 Caching chunks…\n');
       await fileService.write(
         cacheKey,
         Buffer.from(JSON.stringify({ chunks }), 'utf-8')
       );
       res.write('✅ Chunk cache written\n');
     }
 
     /* ------ 3. Generate embeddings --------------------------------------- */
     res.write('🔗 Generating embeddings…\n');
     const texts        = chunks.map(c => c.text);
     const vectorValues = await embeddings.embed(texts);
     res.write('✅ Embeddings generated\n');
 
     /* ------ 4. Upsert to vector store ------------------------------------ */
     res.write('📥 Indexing into vector store…\n');
     const vectors = chunks.map((chunk, i) => ({
       id:       `${path}#${i}`,
       values:   vectorValues[i],
       metadata: { path },
     }));
     await vectorService.upsertVectors(vectors);
     res.write(`✅ Indexed ${vectors.length} chunks\n`);
 
     res.write('🎉 Done! File is ready for semantic search.\n');
     res.end();
   } catch (err) {
     console.error('COGNIFY ERROR:', err);
     res.write(`❌ Error: ${err.message}\n`);
     res.end();
   }
 });
 
 module.exports = router;
 