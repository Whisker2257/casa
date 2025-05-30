// backend/server.js
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const mongoose = require('mongoose');

const authRoutes     = require('./routes/auth');
const projectRoutes  = require('./routes/projects');
const fileRoutes     = require('./routes/files');
const chunkRoutes    = require('./routes/chunk');
const cognifyRoutes  = require('./routes/cognify');
const indexingRoutes = require('./routes/indexing');
const searchRoutes   = require('./routes/search');
const patchRoutes    = require('./routes/patch');
const runRoutes      = require('./routes/run');
const chatRoutes     = require('./routes/chat');
const pdfRoutes      = require('./routes/pdf');
const compareRoutes  = require('./routes/compare');   // ← NEW

const app  = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI, {})
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// ───── Mount API routes ─────
app.use('/api/auth',     authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects', fileRoutes);
app.use('/api/projects', chunkRoutes);
app.use('/api/projects', cognifyRoutes);
app.use('/api/projects', indexingRoutes);
app.use('/api/projects', searchRoutes);
app.use('/api/projects', patchRoutes);
app.use('/api/projects', runRoutes);
app.use('/api/chat',     chatRoutes);
app.use('/api/projects', pdfRoutes);
app.use('/api/projects', compareRoutes);             // ← NEW

app.get('/api/test', (_, res) => res.json({ message: 'Casa backend is running!' }));

app.listen(port, () => console.log(`Server listening on port ${port}`));
