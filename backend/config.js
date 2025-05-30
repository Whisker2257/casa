require('dotenv').config();

module.exports = {
  // …you can add other config groups here later…
  vectorDB: {
    provider:    'pinecone',
    apiKey:      process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENVIRONMENT,
    indexName:   process.env.PINECONE_INDEX_NAME
  }
};
