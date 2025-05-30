// /Users/nashe/casa/backend/routes/chat.js
require('dotenv').config();  // ensure env vars are loaded when this module runs

const express = require('express');
const auth    = require('../middleware/auth');
const OpenAI  = require('openai');

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/chat
 * Streams OpenAI responses back to the client.
 * Expects JSON body: { projectId, messages: [{role, content}, …] }
 */
router.post('/', auth, async (req, res) => {
  try {
    const { messages } = req.body;

    // Truncate context if too long (naive character-based)
    const ALL = messages.reduce((acc, m) => acc + m.content.length, 0);
    if (ALL > 12000) {
      let running = 0, cutIndex = 0;
      for (let i = messages.length - 1; i >= 0; i--) {
        running += messages[i].content.length;
        if (running > 12000) break;
        cutIndex = i;
      }
      messages.splice(0, cutIndex);
    }

    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    const completion = await openai.chat.completions.create({
      model: 'o4-mini',
      stream: true,
      messages
    });

    for await (const part of completion) {
      const chunk = part.choices[0].delta.content;
      if (chunk) res.write(chunk);
    }
    res.end();
  } catch (err) {
    console.error('Chat stream error:', err);
    res.status(500).send(err.message || 'Error in chat stream');
  }
});

module.exports = router;
