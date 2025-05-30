// /Users/nashe/casa/backend/services/mathpixService.js

const axios    = require('axios');
const FormData = require('form-data');

const MATHPIX_BASE = 'https://api.mathpix.com/v3/pdf';

/**
 * Convert a PDF buffer into Mathpix-Markdown (.mmd):
 *   1) POST multipart/form-data file + options_json → get pdf_id
 *   2) Poll GET /v3/pdf/{pdf_id} until status === 'completed'
 *   3) GET /v3/pdf/{pdf_id}.mmd → returns the full MMD text
 */
async function convertPdfToMmd(buffer) {
  // build the multipart form
  const form = new FormData();
  form.append('file', buffer, {
    filename:    'upload.pdf',
    contentType: 'application/pdf',
  });

  // options for /v3/pdf – no conversion_formats.mmd here!
  const options = {
    streaming:             false,
    fullwidth_punctuation: false,
    include_diagram_text:  true,
    rm_spaces:             true,
    rm_fonts:              true,
    // you can add math_inline_delimiters, enable_tables_fallback, etc.
  };
  form.append('options_json', JSON.stringify(options));

  // include your Mathpix credentials plus the form headers
  const headers = {
    ...form.getHeaders(),
    app_id:  process.env.MATHPIX_APP_ID,
    app_key: process.env.MATHPIX_APP_KEY,
  };

  // 1) upload for processing
  const postRes = await axios.post(MATHPIX_BASE, form, { headers });
  const pdf_id = postRes.data.pdf_id;
  if (!pdf_id) {
    throw new Error(`Mathpix upload failed: ${JSON.stringify(postRes.data)}`);
  }

  // 2) poll status
  while (true) {
    const stat = await axios.get(`${MATHPIX_BASE}/${pdf_id}`, { headers });
    if (stat.data.status === 'completed') break;
    if (stat.data.status === 'error') {
      throw new Error(`Mathpix error: ${JSON.stringify(stat.data)}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  // 3) fetch the MMD
  const mmdRes = await axios.get(`${MATHPIX_BASE}/${pdf_id}.mmd`, {
    headers,
    responseType: 'text',
  });

  return mmdRes.data;  // your complete Mathpix-Markdown
}

module.exports = { convertPdfToMmd };
