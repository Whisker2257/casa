// backend/routes/compare.js
require('dotenv').config();

const express          = require('express');
const auth             = require('../middleware/auth');
const { summarizePdf } = require('../services/paperSummarizer');
const OpenAI           = require('openai');

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/projects/:projectId/compare
 * Body: {
 *   paths : string[]         // required – relative PDF paths
 *   focus : string           // optional – “methods”, “results”, etc.
 *   force : boolean          // optional – ignore cached summaries
 * }
 *
 * Streams:
 *   • per-paper progress lines
 *   • final Markdown comparison
 */
router.post('/:projectId/compare', auth, async (req, res) => {
  try {
    const { projectId }                 = req.params;
    const { paths = [], focus = 'overall comparison', force = false } = req.body || {};

    /* ───── Validation ───── */
    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: 'paths array is required' });
    }
    const MAX_PAPERS = 10;
    if (paths.length > MAX_PAPERS) {
      return res.status(400).json({ error: `Too many PDFs – limit is ${MAX_PAPERS}` });
    }

    /* ───── Streaming headers ───── */
    res.setHeader('Content-Type',  'text/plain; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    /* ───── 1. Summarise each PDF ───── */
    const summaries = [];
    for (let i = 0; i < paths.length; i++) {
      const label = `[P${i + 1}]`;
      const p     = paths[i];
      res.write(`🔍 Summarizing ${label} ${p} …\n`);
      try {
        const summary = await summarizePdf(projectId, p, force);
        summaries.push({ label, path: p, summary });
        res.write(`✅ Summary for ${label} done\n`);
      } catch (err) {
        res.write(`❌ Failed ${label}: ${err.message}\n`);
      }
    }

    if (!summaries.length) {
      res.write('\nNo summaries produced; aborting.\n');
      return res.end();
    }

    /* ───── 2. Size guard ───── */
    const TOTAL_CHARS = summaries.reduce((n, s) => n + s.summary.length, 0);
    const MAX_CHARS   = 30_000;               // ~12k tokens safety
    if (TOTAL_CHARS > MAX_CHARS) {
      res.write(`⚠️ Combined summaries too large (${TOTAL_CHARS} chars). Please reduce the number of papers.\n`);
      return res.end();
    }

    /* ───── 3. Build prompt ───── */
    const systemMsg = {
      role: 'system',
      content:
`You are a meticulous research assistant.
Compare the studies ONLY with the provided summaries.
Cite each paper with its label (e.g. [P1]) when making claims.
Do NOT introduce information not present in the summaries.`
    };

    const userMsg = {
      role: 'user',
      content:
`Focus: ${focus}

Summaries:

${summaries.map(s => `${s.label} ${s.summary}`).join('\n\n')}

Write a structured Markdown report with:
- One-paragraph **overview** for each paper (labelled)
- **Comparative Analysis** (agreements, differences, unique contributions)
- **Open Questions / Future Work** bullet list

Remember to cite using [P#].`
    };

    /* ───── 4. Stream GPT-4o synthesis ───── */
    res.write('\n🧠 Generating comparative analysis…\n\n');

    const stream = await openai.chat.completions.create({
      model   : 'gpt-4o',
      stream  : true,
      messages: [systemMsg, userMsg],
      max_tokens : 1500,
      temperature: 0.25,
    });

    for await (const part of stream) {
      const chunk = part.choices[0].delta.content;
      if (chunk) res.write(chunk);
    }
    return res.end();
  } catch (err) {
    console.error('COMPARE ERROR:', err);
    res.status(500).json({ error: err.message || 'Comparison failed' });
  }
});

module.exports = router;
