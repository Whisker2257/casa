// /Users/nashe/casa/backend/routes/search.js
/**
 * Semantic Search endpoint (Brick 7.7 — updated with regex-style filters)
 *
 * POST /api/projects/:projectId/search
 *
 * Body:
 *   {
 *     "query"   : "natural-language text",      // required
 *     "topK"    : 5,                           // optional, default 5
 *     "filters" : {
 *       "path" : { "$regex": "^notes/" }       // optional — only supported key for now
 *     }
 *   }
 *
 * Notes on filters:
 *   • If you supply  { path: { "$regex": "<pattern>" } }
 *     the route applies the regex **after** vector retrieval, because
 *     Pinecone’s native filter language doesn’t support $regex.  
 *   • Other Pinecone-native operators ($eq, $in, etc.) still pass straight through.
 */

 require('dotenv').config();

 const express        = require('express');
 const auth           = require('../middleware/auth');
 const embeddings     = require('../services/embeddings');
 const vectorService  = require('../services/vectorService');
 const chunker        = require('../services/chunker');
 const fileService    = require('../services/fileService');
 
 const router = express.Router();
 
 /* ────────────────────────────────────────────────────────────
    POST /api/projects/:projectId/search
    ──────────────────────────────────────────────────────────── */
 router.post('/:projectId/search', auth, async (req, res) => {
   try {
     const { query, filters = null } = req.body;
     const topK = Number(req.body.topK) || 5;
 
     if (typeof query !== 'string' || !query.trim()) {
       return res.status(400).json({ error: '"query" (non-empty string) is required' });
     }
 
     /* -------- 0.  Regex-style filter extraction ------------------------- */
     let regex      = null;   // RegExp object if user supplied $regex on path
     let dbFilter   = filters;
 
     if (
       filters &&
       typeof filters === 'object' &&
       filters.path &&
       typeof filters.path === 'object' &&
       typeof filters.path.$regex === 'string'
     ) {
       regex = new RegExp(filters.path.$regex, 'i');   // case-insensitive by default
       dbFilter = null;                                // can’t push regex into Pinecone
     }
 
     /* -------- 1.  Embed the query --------------------------------------- */
     const [qVec] = await embeddings.embed([query.trim()]);
 
     /* -------- 2.  Retrieve vector matches ------------------------------- */
     // If we have to filter afterwards, fetch a few extra to compensate.
     const fetchK = regex ? Math.max(50, topK * 5) : topK;
     const rawMatches = await vectorService.queryVectors(qVec, fetchK, dbFilter);
 
     /* -------- 3.  Apply regex filter (if requested) --------------------- */
     const matches = regex
       ? rawMatches.filter(m => regex.test((m.metadata && m.metadata.path) || ''))
       : rawMatches;
 
     /* -------- 4.  Slice to desired topK -------------------------------- */
     const sliced = matches.slice(0, topK);
 
     /* -------- 5.  Re-hydrate snippets ---------------------------------- */
     const cache   = {};      // { [filePath]: chunks[] }
     const results = [];
 
     for (const m of sliced) {
       const [filePath, idxStr] = m.id.split('#');
       const chunkIdx           = Number(idxStr);
 
       // -- 5a.  Load / generate chunk list for this file
       if (!cache[filePath]) {
         const cacheKey = `${req.params.projectId}/${filePath}.chunks.json`;
         try {
           const buf = await fileService.read(cacheKey);
           const parsed = JSON.parse(buf.toString('utf-8'));
           cache[filePath] = parsed.chunks.map(c => ({ text: c.text }));
         } catch {
           try {
             cache[filePath] = await chunker.chunkFile(req.params.projectId, filePath);
           } catch (err) {
             console.error('SEARCH: failed to chunk', filePath, err);
             cache[filePath] = [];
           }
         }
       }
 
       // -- 5b.  Build snippet
       const chunk   = cache[filePath][chunkIdx] || { text: '' };
       const snippet = chunk.text.length > 300
         ? `${chunk.text.slice(0, 297)}…`
         : chunk.text;
 
       results.push({ file: filePath, snippet, score: m.score });
     }
 
     res.json({ results });
   } catch (err) {
     console.error('SEARCH ERROR:', err);
     res.status(500).json({ error: err.message || 'Search failed' });
   }
 });
 
 module.exports = router;
 