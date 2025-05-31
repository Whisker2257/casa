// backend/routes/compare.js
//
// Brick-6 (simplified): only two modes
//   • blank focus  → summary comparison (cached summaries)
//   • non-blank    → generic question across full texts
//
// POST /api/projects/:projectId/compare
// Body: { paths: string[], focus?: string, force?: boolean }
//
// Streams progress + final Markdown answer.
//
require('dotenv').config();

const express             = require('express');
const auth                = require('../middleware/auth');

const OpenAI              = require('openai');
const fileService         = require('../services/fileService');
const { convertPdfToMmd } = require('../services/mathpixService');
const { summarizePdf }    = require('../services/paperSummarizer');

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ────────────────────────────────────────────────────────── */
const BLANK_RE = /^\s*$/;

/* ────────────────────────────────────────────────────────── */
router.post('/:projectId/compare', auth, async (req, res) => {
  try {
    /* ─── inputs ─── */
    const { projectId } = req.params;
    const { paths = [], focus = '', force = false } = req.body || {};

    if (!Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: '`paths` array is required' });
    }
    if (paths.length > 10) {
      return res.status(400).json({ error: 'Too many PDFs – limit is 10.' });
    }

    const mode = BLANK_RE.test(focus) ? 'summary' : 'generic';

    /* ─── streaming headers ─── */
    res.setHeader('Content-Type',  'text/plain; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    res.write(`Mode: ${mode}\n`);

    /* ─── gather content ─── */
    const papers = [];                    // { label, content }
    const MAX_CHARS_EACH = 60_000;        // ~25k tokens – safety per doc
    const MAX_TOTAL_CHARS = 180_000;      // overall guard

    for (let i = 0; i < paths.length; i++) {
      const label = `[P${i + 1}]`;
      const rel   = paths[i];

      res.write(`🔍 Processing ${label} ${rel} …\n`);
      try {
        let content = '';

        if (mode === 'summary') {
          content = await summarizePdf(projectId, rel, force);       // Brick-1 cache
        } else { // generic - use full Mathpix markdown
          const mmdKey = `${projectId}/${rel}.mmd`;
          let mmd;
          try {
            mmd = (await fileService.read(mmdKey)).toString('utf8');
          } catch {
            const pdfBuf = await fileService.read(`${projectId}/${rel}`);
            mmd = await convertPdfToMmd(pdfBuf);
            await fileService.write(mmdKey, Buffer.from(mmd, 'utf8'));
          }

          // soft truncate for context limits
          content = mmd.length > MAX_CHARS_EACH ? mmd.slice(0, MAX_CHARS_EACH) : mmd;
        }

        papers.push({ label, content });
        res.write(`✅ ${label} done\n`);
      } catch (err) {
        res.write(`❌ ${label} failed: ${err.message}\n`);
      }
    }

    if (!papers.length) {
      res.write('\nNo usable inputs – aborting.\n');
      return res.end();
    }

    const totalChars = papers.reduce((n, p) => n + p.content.length, 0);
    if (totalChars > MAX_TOTAL_CHARS) {
      res.write(`⚠️ Combined size ${totalChars} chars exceeds limit (${MAX_TOTAL_CHARS}). Reduce paper count.\n`);
      return res.end();
    }

    /* ─── build prompt ─── */
    res.write('\n🧠 Generating analysis…\n\n');

    const systemMsg = {
      role: 'system',
      content:
`You are an expert research assistant.
Base your answer ONLY on the content provided.
Cite each paper as [P#]. Do NOT add external information.`
    };

    const userMsg = {
      role: 'user',
      content:
`${mode === 'summary'
  ? 'Provide a structured comparative report of the following papers.'
  : `Focus / Question: ${focus.trim()}`}

Content:

${papers.map(p => `${p.label}\n${p.content}`).join('\n\n')}

Write a **Markdown** report with:
- One-paragraph **Overview** for each paper (labelled)
- **Comparative Analysis** (agreements, differences, unique points)
- Answer the focus/question explicitly (if not blank)
- **Open Questions / Future Work** bullet list

Always cite claims using [P#].`
    };

    /* ─── stream GPT-4o ─── */
    const stream = await openai.chat.completions.create({
      model      : 'gpt-4o',
      stream     : true,
      messages   : [systemMsg, userMsg],
      max_tokens : 1600,
      temperature: 0.25
    });

    for await (const part of stream) {
      const txt = part.choices[0].delta.content;
      if (txt) res.write(txt);
    }

    res.end();
  } catch (err) {
    console.error('COMPARE ERROR:', err);
    res.status(500).json({ error: err.message || 'Comparison failed.' });
  }
});

module.exports = router;
