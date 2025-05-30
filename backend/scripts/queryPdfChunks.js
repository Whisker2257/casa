// backend/scripts/queryPdfChunks.js
require('dotenv').config();
const embeddings    = require('../services/embeddings');
const vectorService = require('../services/vectorService');

async function main() {
  // embed a dummy query (we only care that vectors exist)
  const [qVec] = await embeddings.embed(['test']);
  // fetch matches filtered to your PDF
  const matches = await vectorService.queryVectors(
    qVec,
    5,
    { path: process.argv[2] }
  );
  console.log(`Found ${matches.length} chunks for`, process.argv[2]);
  console.log(matches.map(m => m.id));
  process.exit(0);
}

main().catch(err=>{ console.error(err); process.exit(1); });
