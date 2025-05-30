// backend/routes/pdf.js
/**
 * PDF-specific routes (Bricks 0 – 5 + Brick 9)
 *
 * 0. GET  /pdf/summary     – **NEW** single-shot cached summary (≤ 300 words)
 * 1. GET  /pdf/mmd         – Mathpix → .mmd cache
 * 2. POST /pdf/index       – GPT section-parser → sub-chunks → Pinecone
 * 3. POST /pdf/summarize   – Streaming one-shot / two-pass summary  (25 MB guard)
 * 4. GET  /pdf/section     – Extract / 150-word summary of a named section
 * 5. POST /pdf/qa          – RAG QA with full-document fallback **(no truncation)**
 */

 require('dotenv').config();

 const express               = require('express');
 const auth                  = require('../middleware/auth');
 const fileService           = require('../services/fileService');
 const { convertPdfToMmd }   = require('../services/mathpixService');
 const { parseSections }     = require('../services/sectionParser');
 const { chunkText, chunkMmdSections } = require('../services/chunker');
 const embeddings            = require('../services/embeddings');
 const vectorService         = require('../services/vectorService');
 const prompts               = require('../services/prompts');
 const OpenAI                = require('openai');
 
 const router = express.Router();
 const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 
 /* ─────────────────────────── Brick 0 — GET /pdf/summary ────────────────────────────
    • Returns the cached 300-word summary if present.
    • If absent (or force=true) it generates the summary _non-streaming_,
      stores it at <path>.summary.md, then returns the Markdown.            */
 router.get('/:projectId/pdf/summary', auth, async (req, res) => {
   try {
     const { projectId }          = req.params;
     const { path: relPath, force } = req.query;
     if (!relPath) return res.status(400).json({ error: 'path query parameter is required' });
 
     const summaryKey = `${projectId}/${relPath}.summary.md`;
     if (!force || force === 'false') {
       try {
         const buf = await fileService.read(summaryKey);
         return res.type('text/markdown').send(buf.toString('utf8'));
       } catch {/* cache miss – continue */}
     }
 
     /* -------- Ensure Mathpix-Markdown -------- */
     const mmdKey = `${projectId}/${relPath}.mmd`;
     let mmd;
     try {
       mmd = (await fileService.read(mmdKey)).toString('utf8');
     } catch {
       const pdfBuf = await fileService.read(`${projectId}/${relPath}`);
       mmd = await convertPdfToMmd(pdfBuf);
       await fileService.write(mmdKey, Buffer.from(mmd, 'utf8'));
     }
 
     /* -------- One-shot vs two-pass summarisation -------- */
     const ONE_SHOT_LIMIT = 110_000;            // ≈27 k tokens
     let finalSummary = '';
 
     if (mmd.length < ONE_SHOT_LIMIT) {
       const resp = await openai.chat.completions.create({
         model   : 'gpt-4o',
         messages: [
           { role: 'system', content: prompts.summarySystem },
           { role: 'user',   content: prompts.summaryOneShotUser() },
           { role: 'user',   content: mmd }
         ],
         max_tokens: 1024,
         temperature: 0.3,
       });
       finalSummary = resp.choices[0].message.content.trim();
     } else {
       // two-pass
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
           max_tokens: 384,
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
         max_tokens: 768,
         temperature: 0.25,
       });
       finalSummary = merge.choices[0].message.content.trim();
     }
 
     /* -------- Persist & return -------- */
     await fileService.write(summaryKey, Buffer.from(finalSummary, 'utf8'));
     return res.type('text/markdown').send(finalSummary);
 
   } catch (err) {
     console.error('PDF SUMMARY ERROR:', err);
     res.status(500).json({ error: err.message || 'Failed to generate summary' });
   }
 });
 
 /* ───────────────────────────── Brick 1 — GET /pdf/mmd ───────────────────────────── */
 router.get('/:projectId/pdf/mmd', auth, async (req, res) => {
   try {
     const { projectId } = req.params;
     const relPath       = req.query.path;
     if (!relPath) return res.status(400).json({ error: 'path query parameter is required' });
 
     const force    = req.query.force === '1' || req.query.force === 'true';
     const cacheKey = `${projectId}/${relPath}.mmd`;
 
     if (!force) {
       try {
         const buf = await fileService.read(cacheKey);
         return res.type('text/markdown').send(buf.toString('utf8'));
       } catch {/* cache miss */}
     }
 
     const pdfBuf = await fileService.read(`${projectId}/${relPath}`);
     const mmd    = await convertPdfToMmd(pdfBuf);
     await fileService.write(cacheKey, Buffer.from(mmd, 'utf8'));
     res.type('text/markdown').send(mmd);
   } catch (err) {
     console.error('PDF MMD ERROR:', err);
     res.status(500).json({ error: err.message || 'Failed to extract MMD' });
   }
 });
 
 /* ───────────────────────────── Brick 2 — POST /pdf/index ─────────────────────────── */
 router.post('/:projectId/pdf/index', auth, async (req, res) => {
   try {
     const { projectId } = req.params;
     const relPath       = req.body.path;
     if (!relPath) return res.status(400).json({ error: 'path is required in body' });
 
     /* 1) Ensure Mathpix-Markdown */
     const mmdKey = `${projectId}/${relPath}.mmd`;
     let mmd;
     try {
       mmd = (await fileService.read(mmdKey)).toString('utf8');
     } catch {
       const pdfBuf = await fileService.read(`${projectId}/${relPath}`);
       mmd = await convertPdfToMmd(pdfBuf);
       await fileService.write(mmdKey, Buffer.from(mmd, 'utf8'));
     }
 
     /* 2) GPT-o4-mini parses clean section list */
     const sections = await parseSections(mmd);
     if (!sections.length) throw new Error('No sections parsed from PDF');
 
     /* 3) Sub-chunk long sections (≈1 800 chars / 200 overlap) */
     const CHUNK_SIZE = 1800;
     const OVERLAP    = 200;
     const rawChunks  = [];
     sections.forEach((sec, sIdx) => {
       const parts = chunkText(sec.text, { chunkSize: CHUNK_SIZE, overlap: OVERLAP });
       parts.forEach((p, pIdx) => {
         rawChunks.push({
           id     : `sec${sIdx}_${pIdx}`,
           section: sec.title,
           text   : p.text
         });
       });
     });
 
     /* 4) Embed & upsert */
     const texts        = rawChunks.map(c => c.text);
     const vectorValues = await embeddings.embed(texts);
     await vectorService.upsertVectors(rawChunks.map((c, i) => ({
       id      : `pdf::${relPath}::${c.id}`,
       values  : vectorValues[i],
       metadata: { path: relPath, section: c.section }
     })));
 
     res.json({ indexed: rawChunks.length });
   } catch (err) {
     console.error('PDF INDEX ERROR:', err);
     res.status(500).json({ error: err.message || 'Failed to index PDF' });
   }
 });
 
 /* ─────────────────────────── Brick 3 — POST /pdf/summarize ───────────────────────── */
 router.post('/:projectId/pdf/summarize', auth, async (req, res) => {
   res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
   res.setHeader('Cache-Control', 'no-cache, no-transform');
   res.setHeader('X-Accel-Buffering', 'no');
 
   try {
     const { projectId }            = req.params;
     const { path: relPath, force } = req.body;
     if (!relPath) return res.status(400).json({ error: 'path is required' });
 
     /* Brick 9 – size guard (>25 MB needs force) */
     const pdfStat   = await fileService.stat(`${projectId}/${relPath}`);
     const MAX_BYTES = 25 * 1024 * 1024;
     if (pdfStat.ContentLength > MAX_BYTES && !force) {
       return res.status(400).json({
         error: `PDF is ${(pdfStat.ContentLength / 1048576).toFixed(1)} MB; summarization disabled for >25 MB unless force=true`
       });
     }
 
     const summaryKey = `${projectId}/${relPath}.summary.md`;
     if (!force) {
       try {
         const buf = await fileService.read(summaryKey);
         res.write(buf.toString('utf8'));
         return res.end();
       } catch {/* cache miss */}
     }
 
     /* Ensure .mmd */
     const mmdKey = `${projectId}/${relPath}.mmd`;
     let mmd;
     try {
       mmd = (await fileService.read(mmdKey)).toString('utf8');
     } catch {
       const pdfBuf = await fileService.read(`${projectId}/${relPath}`);
       mmd = await convertPdfToMmd(pdfBuf);
       await fileService.write(mmdKey, Buffer.from(mmd, 'utf8'));
     }
 
     /* One-shot vs two-pass */
     const ONE_SHOT_CHAR_LIMIT = 110_000;
     if (mmd.length < ONE_SHOT_CHAR_LIMIT) {
       res.write('🔍 Generating one-shot summary…\n\n');
 
       let summary = '';
       const stream = await openai.chat.completions.create({
         model   : 'gpt-4o',
         stream  : true,
         messages: [
           { role: 'system', content: prompts.summarySystem },
           { role: 'user',   content: prompts.summaryOneShotUser() },
           { role: 'user',   content: mmd }
         ]
       });
       for await (const part of stream) {
         const chunk = part.choices[0].delta.content;
         if (chunk) { res.write(chunk); summary += chunk; }
       }
       await fileService.write(summaryKey, Buffer.from(summary, 'utf8'));
       return res.end();
     }
 
     /* Two-pass */
     res.write('⚙️ Document too large, running two-pass summarization…\n\n');
 
     const sections         = chunkMmdSections(mmd, { maxChars: 50_000, overlapChars: 1_000 });
     const sectionSummaries = [];
 
     for (const sec of sections) {
       res.write(`✂️ Summarizing section "${sec.section}"…\n`);
       const c = await openai.chat.completions.create({
         model   : 'gpt-4o',
         messages: [
           { role: 'system', content: prompts.sectionSummarySystem },
           {
             role   : 'user',
             content: `Summarize the following section in **150 words**.
 
 Section title: **${sec.section}**.
 
 \`\`\`
 ${sec.text}
 \`\`\``
           }
         ]
       });
       sectionSummaries.push({ section: sec.section, summary: c.choices[0].message.content.trim() });
     }
 
     res.write(`\n🔗 Merging ${sectionSummaries.length} section summaries…\n\n`);
     let finalSummary = '';
     const mergeStream = await openai.chat.completions.create({
       model   : 'gpt-4o',
       stream  : true,
       messages: [
         { role: 'system', content: prompts.mergeSummarySystem },
         { role: 'user',   content: prompts.mergeSummaryUser(sectionSummaries) }
       ]
     });
     for await (const part of mergeStream) {
       const chunk = part.choices[0].delta.content;
       if (chunk) { res.write(chunk); finalSummary += chunk; }
     }
     await fileService.write(summaryKey, Buffer.from(finalSummary, 'utf8'));
     return res.end();
   } catch (err) {
     console.error('PDF SUMMARIZE ERROR:', err);
     res.status(500).json({ error: err.message || 'Summarization failed' });
   }
 });
 
 /* ─────────────────────────── Brick 4 — GET /pdf/section ───────────────────── */
 router.get('/:projectId/pdf/section', auth, async (req, res) => {
   res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
   res.setHeader('Cache-Control', 'no-cache, no-transform');
   res.setHeader('X-Accel-Buffering', 'no');
 
   try {
     const { projectId } = req.params;
     const relPath       = req.query.path;
     const name          = req.query.name;
     const mode          = req.query.mode === 'summary' ? 'summary' : 'raw';
     if (!relPath || !name) {
       return res.status(400).json({ error: 'Both path and name query parameters are required' });
     }
 
     const mmd = (await fileService.read(`${projectId}/${relPath}.mmd`)).toString('utf8');
 
     const systemMsg = {
       role: 'system',
       content: 'You are an expert at extracting and summarizing sections from Mathpix-Markdown.'
     };
 
     const userMsg = mode === 'raw'
       ? {
           role: 'user',
           content: `Extract ONLY the section titled "${name}" (with subsections, equations) from the following paper:
 
 \`\`\`
 ${mmd}
 \`\`\``
         }
       : {
           role: 'user',
           content: `Here is the "${name}" section of a research paper:
 
 \`\`\`
 ${mmd}
 \`\`\`
 
 Provide a **150-word summary** of that section.`
         };
 
     const stream = await openai.chat.completions.create({
       model   : 'gpt-4o',
       stream  : true,
       messages: [systemMsg, userMsg]
     });
     for await (const part of stream) {
       const chunk = part.choices[0].delta.content;
       if (chunk) res.write(chunk);
     }
     return res.end();
   } catch (err) {
     console.error('PDF SECTION ERROR:', err);
     res.status(500).json({ error: err.message || 'Failed to extract section' });
   }
 });
 
 /* ─────────────────────────── Brick 5 — POST /pdf/qa ───────────────────────── */
 router.post('/:projectId/pdf/qa', auth, async (req, res) => {
   res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
   res.setHeader('Cache-Control', 'no-cache, no-transform');
   res.setHeader('X-Accel-Buffering', 'no');
 
   try {
     const { projectId }                     = req.params;
     const { path: relPath, question, topK } = { topK: 15, ...req.body };
     if (!relPath || !question) {
       return res.status(400).json({ error: 'path and question are required' });
     }
 
     /* 1) Ensure .mmd */
     const mmdKey = `${projectId}/${relPath}.mmd`;
     let mmd;
     try {
       mmd = (await fileService.read(mmdKey)).toString('utf8');
     } catch {
       const pdfBuf = await fileService.read(`${projectId}/${relPath}`);
       mmd = await convertPdfToMmd(pdfBuf);
       await fileService.write(mmdKey, Buffer.from(mmd, 'utf8'));
     }
 
     /* 2) Heuristic chunks for QA */
     const chunks = chunkMmdSections(mmd);
 
     /* 3) Embed question */
     res.write('🔍 Embedding question…\n');
     const [qVec] = await embeddings.embed([question]);
 
     /* 4) Vector search */
     let rawMatches = await vectorService.queryVectors(qVec, Number(topK), { path: relPath });
 
     /* 5) Auto-index if necessary */
     if (!rawMatches.length) {
       res.write('📦 No vectors found; auto-indexing PDF…\n');
       const texts        = chunks.map(c => c.text);
       const vectorValues = await embeddings.embed(texts);
       await vectorService.upsertVectors(chunks.map((c, i) => ({
         id      : `pdf::${relPath}::${c.id}`,
         values  : vectorValues[i],
         metadata: { path: relPath, section: c.section }
       })));
       res.write('✅ Indexing complete; retrieving sections…\n');
       rawMatches = await vectorService.queryVectors(qVec, Number(topK), { path: relPath });
     }
 
     /* 6) Build RAG prompt */
     const chunkMap = Object.fromEntries(chunks.map(c => [c.id, c]));
     const selected = rawMatches.map(m => {
       const chunkId = m.id.split('::').pop();
       const sec     = chunkMap[chunkId] || { text: '', section: '' };
       return { ...m, text: sec.text, section: sec.section };
     });
 
     res.write('💡 Building context for GPT…\n\n');
     const systemMsg = {
       role: 'system',
       content: `Answer using ONLY the provided context sections.
 If the answer is not contained there, reply "I don't know."
 Cite facts in [Section] format.`
     };
     let userContent = `Question: "${question}"\n\nContext sections:\n`;
     selected.forEach(s => {
       userContent += `---\n[${s.section}]\n${s.text.trim()}\n\n`;
     });
     userContent += '---\nAnswer:';
 
     let initialAnswer = '';
     const initStream = await openai.chat.completions.create({
       model   : 'gpt-4o',
       stream  : true,
       messages: [systemMsg, { role: 'user', content: userContent }]
     });
     for await (const part of initStream) {
       const chunk = part.choices[0].delta.content;
       if (chunk) { res.write(chunk); initialAnswer += chunk; }
     }
 
     /* 7) Full-document fallback (no truncation) */
     if (initialAnswer.trim().toLowerCase().startsWith("i don't know")) {
       res.write('\n\n⚠️ Quick search didn’t find an answer — trying full-document pass…\n\n');
 
       const deepSystem = {
         role: 'system',
         content: `Here is the full text of a paper. Answer the question using only this text.
 If it’s still not in the text, reply "I still don't know."`
       };
       const deepUser = {
         role: 'user',
         content: `Question: "${question}"
 
 Full document text:
 \`\`\`
 ${mmd}
 \`\`\`
 
 Answer:`
       };
 
       const deepStream = await openai.chat.completions.create({
         model   : 'gpt-4o',
         stream  : true,
         messages: [deepSystem, deepUser]
       });
       for await (const part of deepStream) {
         const chunk = part.choices[0].delta.content;
         if (chunk) res.write(chunk);
       }
     }
 
     return res.end();
   } catch (err) {
     console.error('PDF QA ERROR:', err);
     res.status(500).json({ error: err.message || 'PDF Q&A failed' });
   }
 });
 
 module.exports = router;
 