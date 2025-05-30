// /Users/nashe/casa/backend/middleware/upload.js
const multer = require('multer');

// keep files in memory so we can forward to S3
const storage = multer.memoryStorage();

module.exports = multer({ storage });
