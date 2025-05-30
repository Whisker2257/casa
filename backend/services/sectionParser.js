// backend/services/sectionParser.js
/**
 * -----------------------------------------------------------------------------
 *  GPT-powered Section Parser
 *  • parseSections(mmd) → Promise<Array<{ title:string, text:string }>>
 *    – Uses the o4-mini model to return a clean JSON list of sections.
 *    – Falls back to the heuristic chunkMmdSections if JSON parsing fails.
 * -----------------------------------------------------------------------------
 */

 require('dotenv').config();
 const OpenAI             = require('openai');
 const { chunkMmdSections } = require('./chunker');   // heuristic fallback
 
 const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 
 /**
  * Ask GPT to convert Mathpix-Markdown into an ordered section list.
  * @param {string} mmd
  * @returns {Promise<Array<{ title:string, text:string }>>}
  */
 async function parseSections(mmd) {
   // Guard: truncate giant documents to keep request < 110k chars
   const MAX_CHARS = 110000;               // ~27k tokens
   const promptMmd = mmd.length > MAX_CHARS ? mmd.slice(0, MAX_CHARS) : mmd;
 
   const system = {
     role : 'system',
     content :
       'You are a strict, deterministic JSON formatter that never writes prose.'
   };
 
   const user = {
     role : 'user',
     content :
 `Below is Mathpix-Markdown for a scientific paper.
 
 Return **ONLY** valid JSON – an array where each item has:
 
   • "title" : the section heading (string, keep original capitalisation)
   • "text"  : full raw lines that belong to that section (string)
 
 Omit any trailing References / Bibliography sections.
 
 JSON ONLY!
 
 ----- BEGIN MMD -----
 ${promptMmd}
 ----- END MMD -----`
   };
 
   try {
     const resp = await openai.chat.completions.create({
       model      : 'o4-mini',
       messages   : [system, user],
       max_tokens : 4096,
       temperature: 0.0,
     });
 
     const json = resp.choices[0].message.content.trim();
     const parsed = JSON.parse(json);
     if (!Array.isArray(parsed)) throw new Error('Not array');
     return parsed.map(s => ({
       title : String(s.title || '').trim(),
       text  : String(s.text  || '').trim()
     })).filter(s => s.title && s.text);
   } catch (err) {
     console.warn('⚠️ sectionParser fallback –', err.message);
     // Fallback to deterministic regex-based splitter
     return chunkMmdSections(mmd).map(c => ({
       title : c.section,
       text  : c.text
     }));
   }
 }
 
 module.exports = { parseSections };
 