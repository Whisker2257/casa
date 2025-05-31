// backend/services/sectionExtractor.js
//
// Robust section-extraction helper
// ---------------------------------------------
//  extractSection(projectId, relPath, sectionName [, force])
//     → returns raw Markdown for that section
//
//  • Accepts “Introduction”, “intro”, “1 Introduction”, “I. INTRODUCTION” …
//  • On first run converts <pdf>.mmd using mathpixService (cached).
//  • If a heading isn’t found, returns null so callers can fall back.
//
require('dotenv').config();

const fileService         = require('./fileService');
const { convertPdfToMmd } = require('./mathpixService');

const HEADING_RE = /^#+\s*(.+?)\s*$/m;          // generic markdown heading

// Map canonical name → array of loose regexes (case-insensitive)
const SECTION_REGEXES = {
  Abstract: [
    /abstract/i
  ],
  Introduction: [
    /introduction/i,
    /\bintro\b/i,
    /\b1\.?\s*introduction\b/i,
    /\bi\.?\s*introduction\b/i
  ],
  Background: [
    /\bbackground\b/i,
    /\brelated\s+work\b/i
  ],
  Methods: [
    /\bmaterials?\s+and\s+methods\b/i,
    /\bmethodology\b/i,
    /\bmethods?\b/i,
    /\b2\.?\s*methods?\b/i,
    /\bii\.?\s*methods?\b/i
  ],
  Results: [
    /\bresults?\b/i,
    /\bexperiments?\b/i,
    /\bfindings?\b/i
  ],
  Discussion: [
    /\bdiscussion\b/i
  ],
  Conclusion: [
    /\bconclusions?\b/i,
    /\bsummary\b/i
  ],
  Limitations: [
    /\blimitations?\b/i
  ],
  'Future Work': [
    /\bfuture\s+work\b/i
  ],
  'Related Work': [
    /\brelated\s+work\b/i
  ]
};

/* -------------------------------------------------------- */
async function loadMmd(projectId, relPath, force = false) {
  const mmdKey = `${projectId}/${relPath}.mmd`;

  if (!force) {
    try {
      return (await fileService.read(mmdKey)).toString('utf8');
    } catch { /* cache miss */ }
  }

  const pdfBuf = await fileService.read(`${projectId}/${relPath}`);
  const mmd    = await convertPdfToMmd(pdfBuf);
  await fileService.write(mmdKey, Buffer.from(mmd, 'utf8'));
  return mmd;
}

/* -------------------------------------------------------- */
function findHeadingIndices(lines, regexes) {
  let start = -1;
  let end   = lines.length;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(HEADING_RE);
    if (!m) continue;

    const heading = m[1].trim();
    if (regexes.some((re) => re.test(heading))) {
      start = i;
      break;
    }
  }
  if (start === -1) return null;

  // find next heading (same or higher level) to mark the end
  const currentLevel = (lines[start].match(/^#+/)[0] || '').length;
  for (let j = start + 1; j < lines.length; j++) {
    const m = lines[j].match(HEADING_RE);
    if (!m) continue;
    const lvl = (lines[j].match(/^#+/)[0] || '').length;
    if (lvl <= currentLevel) {
      end = j;
      break;
    }
  }
  return { start, end };
}

/* -------------------------------------------------------- */
async function extractSection(projectId, relPath, sectionName, force = false) {
  if (!sectionName) return null;

  const mmd   = await loadMmd(projectId, relPath, force);
  const lines = mmd.split(/\r?\n/);

  const regexes = SECTION_REGEXES[sectionName] || [new RegExp(sectionName, 'i')];
  const idx     = findHeadingIndices(lines, regexes);

  if (!idx) return null;                       // caller will handle fallback
  const slice  = lines.slice(idx.start, idx.end);
  return slice.join('\n').trim();
}

module.exports = { extractSection };
