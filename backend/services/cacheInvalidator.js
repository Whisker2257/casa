// backend/services/cacheInvalidator.js
/**
 * Invalidate cached artefacts when a PDF is replaced.
 */

 const fileService   = require('./fileService');
 const vectorService = require('./vectorService');
 
 /**
  * Delete .mmd, .summary.md, and all pdf::<path>::* vectors.
  * @param {string} projectId
  * @param {string} relPath   e.g. "papers/foo.pdf"
  */
 async function invalidatePdf(projectId, relPath) {
   const keys = [
     `${projectId}/${relPath}.mmd`,
     `${projectId}/${relPath}.summary.md`
   ];
 
   for (const k of keys) {
     try { await fileService.delete(k); } catch { /* ignore */ }
   }
   try {
     await vectorService.deleteVectorsByPath(relPath);
   } catch { /* ignore */ }
 }
 
 module.exports = { invalidatePdf };
 