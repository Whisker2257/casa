// backend/routes/files.js
const express              = require('express');
const auth                 = require('../middleware/auth');
const upload               = require('../middleware/upload');
const fileService          = require('../services/fileService');
const { invalidatePdf }    = require('../services/cacheInvalidator');   // ★ NEW

const router = express.Router();
router.use(auth);

/* ───────────────────────── Manifest ───────────────────────── */
router.get('/:projectId/manifest', async (req, res) => {
  try {
    const prefix    = `${req.params.projectId}/`;
    const items     = await fileService.listAll(prefix);
    const formatted = items.map(i => ({
      path : i.path.replace(prefix, ''),
      isDir: i.isDir
    }));
    res.json({ items: formatted });
  } catch (err) {
    console.error('MANIFEST ERROR', err);
    res.status(500).json({ error: 'Could not load manifest' });
  }
});

/* ───────────────────────── List dir ───────────────────────── */
router.get('/:projectId/files', async (req, res) => {
  try {
    const { projectId } = req.params;
    const relPath       = req.query.path || '';
    const prefix        = `${projectId}/${relPath}`.replace(/\/?$/, '/');
    const files         = await fileService.list(prefix);
    res.json({ files });
  } catch (err) {
    console.error('LIST FILES ERROR', err);
    res.status(500).json({ error: 'Could not list files' });
  }
});

/* ───────────────────────── Download ───────────────────────── */
router.get('/:projectId/file', async (req, res) => {
  try {
    const { projectId } = req.params;
    const relPath       = req.query.path;
    if (!relPath) return res.status(400).json({ error: 'Path required' });

    const fullKey = `${projectId}/${relPath}`;
    const data    = await fileService.read(fullKey);

    const ext = relPath.split('.').pop().toLowerCase();
    const mime =
      ext === 'pdf'  ? 'application/pdf'
      : ext === 'md' ? 'text/markdown'
      : ['js','ts'].includes(ext) ? 'application/javascript'
      : ['py','txt','json'].includes(ext) ? 'text/plain'
      : ext === 'png'  ? 'image/png'
      : ['jpg','jpeg'].includes(ext) ? 'image/jpeg'
      : ['gif','bmp'].includes(ext)  ? `image/${ext}`
      : ext === 'svg' ? 'image/svg+xml'
      : 'application/octet-stream';

    res.set('Content-Type', mime);
    res.send(data);
  } catch (err) {
    console.error('DOWNLOAD ERROR', err);
    res.status(500).json({ error: 'Could not download file' });
  }
});

/* ───────────────────────── Tree ───────────────────────── */
router.get('/:projectId/tree', async (req, res) => {
  try {
    const items = await fileService.listAll(`${req.params.projectId}/`);
    res.json({ items: items.filter(i => i.isDir) });
  } catch (err) {
    console.error('TREE ERROR', err);
    res.status(500).json({ error: 'Could not load tree' });
  }
});

/* ───────────────────────── Upload ───────────────────────── */
router.post(
  '/:projectId/upload',
  upload.single('file'),
  async (req, res) => {
    try {
      const { projectId } = req.params;
      const relPath       = req.body.path || '';
      const filename      = req.file.originalname;
      const key           = `${projectId}/${relPath}`.replace(/\/?$/, '/') + filename;

      /* Determine if this upload is replacing an existing file */
      let replacing = false;
      try { await fileService.stat(key); replacing = true; } catch {}

      /* Save the new file */
      await fileService.write(key, req.file.buffer);

      /* If replacing a PDF, invalidate caches & vectors */
      if (replacing && filename.toLowerCase().endsWith('.pdf')) {
        const pdfRel = `${relPath}`.replace(/\/?$/, '/') + filename; // relative inside project
        await invalidatePdf(projectId, pdfRel);
      }

      res.json({ message: 'File uploaded', path: key });
    } catch (err) {
      console.error('UPLOAD ERROR', err);
      res.status(500).json({ error: 'Upload failed' });
    }
  }
);

/* ───────────────────────── Create folder ───────────────────────── */
router.post('/:projectId/folder', async (req, res) => {
  try {
    const folderKey = `${req.params.projectId}/${req.body.path || ''}`.replace(/\/?$/, '/');
    await fileService.write(folderKey, Buffer.alloc(0));
    res.json({ message: 'Folder created', path: folderKey });
  } catch (err) {
    console.error('MKDIR ERROR', err);
    res.status(500).json({ error: 'Could not create folder' });
  }
});

/* ───────────────────────── Create empty file ───────────────────────── */
router.post('/:projectId/file', async (req, res) => {
  try {
    const { projectId }     = req.params;
    const { path, name }    = req.body;
    if (!path || !name) return res.status(400).json({ error: 'Path and name required' });

    const key = `${projectId}/${path}`.replace(/\/?$/, '/') + name;
    await fileService.write(key, Buffer.alloc(0));
    res.json({ message: 'File created', path: key });
  } catch (err) {
    console.error('CREATE FILE ERROR', err);
    res.status(500).json({ error: 'Could not create file' });
  }
});

/* ───────────────────────── Rename ───────────────────────── */
router.patch('/:projectId/rename', async (req, res) => {
  try {
    const { projectId }          = req.params;
    const { oldPath, newName }   = req.body;
    if (!oldPath || !newName) return res.status(400).json({ error: 'oldPath and newName required' });

    const fullOld = `${projectId}/${oldPath}`.replace(/^\/+/, '');
    const isDir   = fullOld.endsWith('/');

    if (isDir) {
      const oldPrefix     = fullOld.replace(/\/?$/, '/');
      const parentRel     = oldPath.split('/').slice(0, -2).join('/');
      const newPrefixFull = `${projectId}/${parentRel}/${newName}`.replace(/\/?$/, '/');
      const objects       = await fileService.listAll(oldPrefix);

      for (const obj of objects) {
        const suffix = obj.path.replace(oldPrefix, '');
        const target = newPrefixFull + suffix;
        const data   = await fileService.read(obj.path);
        await fileService.write(target, data);
        await fileService.delete(obj.path);
      }
      return res.json({ message: 'Directory renamed', oldPath: oldPrefix, newPath: newPrefixFull });
    } else {
      const parts   = oldPath.split('/');
      parts[parts.length - 1] = newName;
      const newRel  = parts.join('/');
      const fullNew = `${projectId}/${newRel}`;
      const data    = await fileService.read(fullOld);

      await fileService.write(fullNew, data);
      await fileService.delete(fullOld);
      return res.json({ message: 'File renamed', oldPath: fullOld, newPath: fullNew });
    }
  } catch (err) {
    console.error('RENAME ERROR', err);
    res.status(500).json({ error: 'Rename failed' });
  }
});

/* ───────────────────────── Delete ───────────────────────── */
router.delete('/:projectId/delete', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { path }      = req.body;
    if (!path) return res.status(400).json({ error: 'Path required' });

    const fullKey = `${projectId}/${path.replace(/^\/+/, '')}`;

    if (fullKey.endsWith('/')) {
      const objects = await fileService.listAll(fullKey);
      for (const obj of objects) await fileService.delete(obj.path);
      await fileService.delete(fullKey);
    } else {
      await fileService.delete(fullKey);
    }
    res.json({ message: 'Deleted', path: fullKey });
  } catch (err) {
    console.error('DELETE ERROR', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
