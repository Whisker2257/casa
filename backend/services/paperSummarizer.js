// backend/services/paperSummarizer.js
/**
 * Paper-level summarisation helper  (Brick 2 — re-vamped)
 *
 *  ───────── Public surface ─────────
 *   summarizePdf(projectId, relPath [, force] [, { silent }])
 *   summarizeMany(projectId, paths  [, force] [, { silent }])
 *
 *   getSummary(absOrRelPath [, { force, silent }])
 *       → { summary: string }
 *
 *  · `silent:true` suppresses console output (used by compare.js)
 *  · No HTTP round-trips – works entirely in-process.
 */

 require('dotenv').config();

 const OpenAI                 = require('openai');
 const fileService            = require('./fileService');
 const { convertPdfToMmd }    = require('./mathpixService');
 const { chunkMmdSections }   = require('./chunker');
 const prompts                = require('./prompts');
 
 const openai         = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 const ONE_SHOT_LIMIT = 110_000;   // ~27 k tokens in MMD
 
 /* ════════════════════════════════════════════════════════════════
    Internal: resolve a projectId / relPath pair from a raw path.
    If the path already contains a slash and the 1st segment has a
    dot (likely a file), we treat projectId = '' (root project).
    Otherwise the 1st segment is the projectId.
    Examples:
       "papers/foo.pdf"        → ['',          'papers/foo.pdf']
       "projA/papers/foo.pdf"  → ['projA',     'papers/foo.pdf']
    You can override by passing explicit projectId / relPath.
    ════════════════════════════════════════════════════════════════ */
 function resolvePair(rawPath) {
   const p = rawPath.replace(/^\/+/, '');               // drop leading “/”
   const [first, ...rest] = p.split('/');
   if (first.includes('.')) return ['', p];             // no explicit project
   return [first, rest.join('/')];
 }
 
 /* ──────────────────────────────────────────────────────────
    Summarise a single PDF  (cached, may create mmd + summary)
    ────────────────────────────────────────────────────────── */
 async function summarizePdf(projectId, relPath, force = false, { silent = false } = {}) {
   const summaryKey = `${projectId ? projectId + '/' : ''}${relPath}.summary.md`;
 
   /* 1️⃣  Return cached summary if present */
   if (!force) {
     try {
       const buf = await fileService.read(summaryKey);
       return buf.toString('utf8');
     } catch { /* cache miss – continue */ }
   }
 
   if (!silent) console.log(`→ summarising ${projectId}/${relPath}`);
 
   /* 2️⃣  Ensure Mathpix-Markdown (.mmd) exists */
   const mmdKey = `${projectId ? projectId + '/' : ''}${relPath}.mmd`;
   let mmd;
   try {
     mmd = (await fileService.read(mmdKey)).toString('utf8');
   } catch {
     const pdfBuf = await fileService.read(`${projectId ? projectId + '/' : ''}${relPath}`);
     mmd = await convertPdfToMmd(pdfBuf);
     await fileService.write(mmdKey, Buffer.from(mmd, 'utf8'));
   }
 
   /* 3️⃣  Generate summary  (one-shot or two-pass) */
   let finalSummary = '';
 
   if (mmd.length < ONE_SHOT_LIMIT) {
     const resp = await openai.chat.completions.create({
       model: 'gpt-4o',
       messages: [
         { role: 'system', content: prompts.summarySystem },
         { role: 'user',   content: prompts.summaryOneShotUser() },
         { role: 'user',   content: mmd }
       ],
       max_tokens : 1024,
       temperature: 0.3
     });
     finalSummary = resp.choices[0].message.content.trim();
   } else {
     /* two-pass – chunk then merge */
     const sections         = chunkMmdSections(mmd, { maxChars: 50_000, overlapChars: 1_000 });
     const sectionSummaries = [];
 
     for (const sec of sections) {
       const c = await openai.chat.completions.create({
         model: 'gpt-4o',
         messages: [
           { role: 'system', content: prompts.sectionSummarySystem },
           {
             role   : 'user',
             content: `Summarise the following section in **150 words**.\n\nSection title: **${sec.section}**.\n\n\`\`\`\n${sec.text}\n\`\`\``
           }
         ],
         max_tokens : 384,
         temperature: 0.3
       });
       sectionSummaries.push({ section: sec.section, summary: c.choices[0].message.content.trim() });
     }
 
     const merge = await openai.chat.completions.create({
       model: 'gpt-4o',
       messages: [
         { role: 'system', content: prompts.mergeSummarySystem },
         { role: 'user',   content: prompts.mergeSummaryUser(sectionSummaries) }
       ],
       max_tokens : 768,
       temperature: 0.25
     });
     finalSummary = merge.choices[0].message.content.trim();
   }
 
   /* 4️⃣  Persist & return */
   await fileService.write(summaryKey, Buffer.from(finalSummary, 'utf8'));
   return finalSummary;
 }
 
 /* ──────────────────────────────────────────────────────────
    Summarise many PDFs in parallel
    ────────────────────────────────────────────────────────── */
 async function summarizeMany(projectId, paths, force = false, { silent = false } = {}) {
   if (!Array.isArray(paths) || !paths.length) return [];
 
   const tasks = paths.map((p) =>
     summarizePdf(projectId, p, force, { silent })
       .then((summary) => ({ path: p, summary, error: null }))
       .catch((err)   => ({ path: p, summary: '', error: err.message }))
   );
 
   return Promise.all(tasks);
 }
 
 /* ──────────────────────────────────────────────────────────
    Convenience helper used by compare.js
    getSummary("/path/to/file.pdf") → { summary }
    ────────────────────────────────────────────────────────── */
 async function getSummary(rawPath, { force = false, silent = false } = {}) {
   const [projectId, relPath] = resolvePair(rawPath);
   const summary = await summarizePdf(projectId, relPath, force, { silent });
   return { summary };
 }
 
 module.exports = {
   summarizePdf,
   summarizeMany,
   getSummary            // 👈 new export
 };
 