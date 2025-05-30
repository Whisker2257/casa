// backend/services/paperSummarizer.js
/**
 * Paper-level summarisation helper (Brick 2)
 *
 *  • summarizePdf(projectId, relPath [, force])   → returns Markdown string
 *  • summarizeMany(projectId, paths [, force])    → parallel (Promise.all) array of
 *      { path, summary } objects, preserving input order.
 *
 * Internally mirrors the logic of GET /pdf/summary (Brick 1) but avoids HTTP
 * round-trips so the comparison pipeline can call it directly.
 */

 require('dotenv').config();

 const OpenAI              = require('openai');
 const fileService         = require('./fileService');
 const { convertPdfToMmd } = require('./mathpixService');
 const { chunkMmdSections } = require('./chunker');
 const prompts             = require('./prompts');
 
 const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 const ONE_SHOT_LIMIT = 110_000;     // ~27 k tokens in MMD
 
 /* ──────────────────────────────────────────────────────────
    Summarise a single PDF (cached)
    ────────────────────────────────────────────────────────── */
 async function summarizePdf(projectId, relPath, force = false) {
   const summaryKey = `${projectId}/${relPath}.summary.md`;
 
   /* --- 1. Return cached summary if present --- */
   if (!force) {
     try {
       const buf = await fileService.read(summaryKey);
       return buf.toString('utf8');
     } catch { /* cache miss – fall through */ }
   }
 
   /* --- 2. Ensure Mathpix-Markdown text --- */
   const mmdKey = `${projectId}/${relPath}.mmd`;
   let mmd;
   try {
     mmd = (await fileService.read(mmdKey)).toString('utf8');
   } catch {
     const pdfBuf = await fileService.read(`${projectId}/${relPath}`);
     mmd = await convertPdfToMmd(pdfBuf);
     await fileService.write(mmdKey, Buffer.from(mmd, 'utf8'));
   }
 
   /* --- 3. Generate summary (one-shot vs two-pass) --- */
   let finalSummary = '';
 
   if (mmd.length < ONE_SHOT_LIMIT) {
     const resp = await openai.chat.completions.create({
       model   : 'gpt-4o',
       messages: [
         { role: 'system', content: prompts.summarySystem },
         { role: 'user',   content: prompts.summaryOneShotUser() },
         { role: 'user',   content: mmd }
       ],
       max_tokens : 1024,
       temperature: 0.3,
     });
     finalSummary = resp.choices[0].message.content.trim();
   } else {
     /* two-pass → section summaries then merge */
     const sections         = chunkMmdSections(mmd, { maxChars: 50_000, overlapChars: 1_000 });
     const sectionSummaries = [];
 
     for (const sec of sections) {
       const c = await openai.chat.completions.create({
         model   : 'gpt-4o',
         messages: [
           { role: 'system', content: prompts.sectionSummarySystem },
           {
             role   : 'user',
             content: `Summarize the following section in **150 words**.\n\nSection title: **${sec.section}**.\n\n\`\`\`\n${sec.text}\n\`\`\``
           }
         ],
         max_tokens : 384,
         temperature: 0.3,
       });
       sectionSummaries.push({ section: sec.section, summary: c.choices[0].message.content.trim() });
     }
 
     const merge = await openai.chat.completions.create({
       model   : 'gpt-4o',
       messages: [
         { role: 'system', content: prompts.mergeSummarySystem },
         { role: 'user',   content: prompts.mergeSummaryUser(sectionSummaries) }
       ],
       max_tokens : 768,
       temperature: 0.25,
     });
     finalSummary = merge.choices[0].message.content.trim();
   }
 
   /* --- 4. Persist & return --- */
   await fileService.write(summaryKey, Buffer.from(finalSummary, 'utf8'));
   return finalSummary;
 }
 
 /* ──────────────────────────────────────────────────────────
    Summarise many PDFs in parallel
    ────────────────────────────────────────────────────────── */
 async function summarizeMany(projectId, paths, force = false) {
   if (!Array.isArray(paths) || !paths.length) return [];
 
   const tasks = paths.map((p) =>
     summarizePdf(projectId, p, force)
       .then((summary) => ({ path: p, summary, error: null }))
       .catch((err)   => ({ path: p, summary: '', error: err.message }))
   );
 
   const results = await Promise.all(tasks);
   return results;   // consumer can filter for .error if needed
 }
 
 module.exports = { summarizePdf, summarizeMany };
 