// /Users/nashe/casa/backend/services/embeddings.js

const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * embed(texts)
 * @param {string[]} texts
 * @returns {Promise<number[][]>} array of embedding vectors
 */
async function embed(texts) {
  if (!Array.isArray(texts)) {
    throw new Error('Input to embed must be an array of strings');
  }
  const maxRetries = 3;
  let attempt = 0;
  const backoff = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  while (true) {
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: texts,
      });
      // response.data is an array of { embedding: number[], index: number }
      return response.data.map((item) => item.embedding);
    } catch (err) {
      attempt++;
      const isRateLimit =
        err.status === 429 ||
        err.code === 'RateLimitError' ||
        (err.message && err.message.toLowerCase().includes('rate limit'));

      if (isRateLimit && attempt <= maxRetries) {
        const waitTime = 2 ** attempt * 1000;
        console.warn(`Embeddings rate limit, retrying in ${waitTime}ms (attempt ${attempt})`);
        await backoff(waitTime);
        continue;
      }
      throw err;
    }
  }
}

module.exports = { embed };
