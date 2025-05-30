// backend/services/vectorService.js
require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');
const config       = require('../config');

const pinecone = new Pinecone({ apiKey: config.vectorDB.apiKey });

/* lazy-init singleton */
let _index;
async function getIndex() {
  if (_index) return _index;
  _index = pinecone.index(config.vectorDB.indexName);
  return _index;
}

/* ---------------- public helpers ---------------- */

async function upsertVectors(vectors) {
  if (!Array.isArray(vectors) || !vectors.length) return;
  const index = await getIndex();
  await index.upsert(vectors);
}

async function queryVectors(vector, topK = 5, filter = null) {
  const index = await getIndex();
  const { matches = [] } = await index.query({
    vector,
    topK,
    includeMetadata : true,
    ...(filter ? { filter } : {})
  });
  return matches.map(m => ({ id: m.id, score: m.score, metadata: m.metadata }));
}

/**
 * Delete every vector whose metadata.path === relPath
 * (i.e. all pdf::<relPath>::* IDs)
 */
async function deleteVectorsByPath(relPath) {
  const index = await getIndex();
  await index.delete({ filter: { path: relPath } });
}

module.exports = { upsertVectors, queryVectors, deleteVectorsByPath };
