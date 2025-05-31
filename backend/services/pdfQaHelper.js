// backend/services/pdfQaHelper.js
// Lightweight non‑streaming PDF QA helper for internal use (Brick‑6).
// Mirrors the /pdf/qa route logic but returns a single answer string
// and caches the result per (path + question).

require('dotenv').config();

const crypto              = require('crypto');
const fileService         = require('./fileService');
const { convertPdfToMmd } = require('./mathpixService');
const { chunkMmdSections } = require('./chunker');
const embeddings          = require('./embeddings');
const vectorService       = require('./vectorService');
const OpenAI              = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Answer a question using the content of a PDF. Caches each unique
 * (path, question) combo under <path>.<hash>.qa.md.
 * @param {string} projectId
 * @param {string} relPath
 * @param {string} question
 * @param {boolean} force
 */
async function answerQuestion(projectId, relPath, question, force = false) {
  const qHash    = sha256(question).slice(0, 16);
  const cacheKey = `${projectId}/${relPath}.${qHash}.qa.md`;

  if (!force) {
    try {
      const buf = await fileService.read(cacheKey);
      return buf.toString('utf8');
    } catch {/* cache miss */}
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

  /* 2) Heuristic chunks */
  const chunks = chunkMmdSections(mmd);

  /* 3) Embed question */
  const [qVec] = await embeddings.embed([question]);

  /* 4) Vector search */
  let rawMatches = await vectorService.queryVectors(qVec, 15, { path: relPath });

  /* 5) Auto‑index if needed */
  if (!rawMatches.length) {
    const texts        = chunks.map(c => c.text);
    const vectorValues = await embeddings.embed(texts);
    await vectorService.upsertVectors(chunks.map((c, i) => ({
      id      : `pdf::${relPath}::${c.id}`,
      values  : vectorValues[i],
      metadata: { path: relPath, section: c.section }
    })));
    rawMatches = await vectorService.queryVectors(qVec, 15, { path: relPath });
  }

  /* 6) Build context */
  const chunkMap = Object.fromEntries(chunks.map(c => [c.id, c]));
  const selected = rawMatches.map(m => {
    const chunkId = m.id.split('::').pop();
    const sec     = chunkMap[chunkId] || { text: '', section: '' };
    return { ...m, text: sec.text, section: sec.section };
  });

  const systemMsg = {
    role: 'system',
    content: `Answer using ONLY the provided context sections. If the answer is not inside, reply "I don't know." Cite facts in [Section] format.`
  };
  let userContent = `Question: "${question}"\n\nContext sections:\n`;
  selected.forEach(s => {
    userContent += `---\n[${s.section}]\n${s.text.trim()}\n\n`;
  });
  userContent += '---\nAnswer:';

  const resp = await openai.chat.completions.create({
    model   : 'gpt-4o',
    messages: [systemMsg, { role: 'user', content: userContent }],
    max_tokens : 512,
    temperature: 0.25,
  });

  const answer = resp.choices[0].message.content.trim();
  await fileService.write(cacheKey, Buffer.from(answer, 'utf8'));
  return answer;
}

module.exports = { answerQuestion };
