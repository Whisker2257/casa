// backend/services/chunker.js
/* eslint-disable no-use-before-define */

const fileService = require('./fileService');

/* ──────────────────────────────────────────────────────────
   1)  Generic char-based chunker (used by Cognify & /chunk)
   ────────────────────────────────────────────────────────── */
/**
 * Split *text* into overlapping character windows.
 *
 * @param {string} text
 * @param {{ chunkSize?: number, overlap?: number }} opts
 * @returns {Array<{ id:string, text:string }>}
 */
function chunkText(
  text,
  { chunkSize = 1800, overlap = 200 } = {}        // ★ new defaults
) {
  if (typeof text !== 'string') text = String(text ?? '');

  const chunks = [];
  let start = 0;
  let part  = 0;
  while (start < text.length) {
    const slice = text.slice(start, start + chunkSize);
    chunks.push({ id: String(part), text: slice });
    part  += 1;
    start += chunkSize - overlap;
  }
  return chunks;
}

/* ──────────────────────────────────────────────────────────
   2)  Helper to chunk any stored file
   ────────────────────────────────────────────────────────── */
async function chunkFile(projectId, relPath, opts = {}) {
  const key  = `${projectId}/${relPath}`.replace(/^\/+/, '');
  const buf  = await fileService.read(key);
  const text = buf.toString('utf8');
  return chunkText(text, opts);
}

/* ──────────────────────────────────────────────────────────
   3)  Mathpix-Markdown section chunker (PDF pipeline)
   ────────────────────────────────────────────────────────── */
function chunkMmdSections(
  mmd,
  { maxChars = 3200, overlapChars = 200 } = {}
) {
  const lines    = mmd.split('\n');
  const sections = [];
  let curTitle = 'Preamble';
  let buf      = [];

  for (const line of lines) {
    const m = line.match(/^\\section\*{(.+?)}/);
    if (m) {
      if (buf.length) sections.push({ title: curTitle, text: buf.join('\n') });
      curTitle = m[1];
      buf      = [line];
    } else {
      buf.push(line);
    }
  }
  if (buf.length) sections.push({ title: curTitle, text: buf.join('\n') });

  const out = [];
  sections.forEach((sec, sIdx) => {
    const { title, text } = sec;
    if (text.length <= maxChars) {
      out.push({ id: `sec${sIdx}`, section: title, text });
    } else {
      let start = 0, part = 0;
      while (start < text.length) {
        out.push({
          id:      `sec${sIdx}_part${part}`,
          section: title,
          text:    text.slice(start, start + maxChars),
        });
        start += maxChars - overlapChars;
        part  += 1;
      }
    }
  });
  return out;
}

/* ──────────────────────────────────────────────────────────
   Public API
   ────────────────────────────────────────────────────────── */
module.exports = {
  chunkText,
  chunkFile,
  chunkMmdSections,
};
