// backend/services/fileService.js
/**
 * Centralised S3 helper
 *
 * • All ordinary “list” operations HIDE internal *.chunks.json cache files.
 * • listAll(prefix, includeCache = false) accepts a second boolean argument:
 *       – includeCache = false  (default)  → hide cache objects
 *       – includeCache = true             → include cache objects (used by /cognified route)
 *
 * Added:
 *   • stat(key)  → HEAD request (used for cache-invalidation on file replacement)
 */

 const AWS = require('aws-sdk');

 /* ─────────────────────────────────────────────────────────
  *                    AWS CONFIG
  * ───────────────────────────────────────────────────────── */
 const s3     = new AWS.S3();
 const BUCKET = process.env.AWS_S3_BUCKET;
 
 /* ─────────────────────────────────────────────────────────
  *                    HELPERS
  * ───────────────────────────────────────────────────────── */
 function sanitize(p) {
   return p.replace(/\.\.\//g, '').replace(/^\/+/g, '');
 }
 function isCacheFile(key) {
   return key.endsWith('.chunks.json');
 }
 
 /* ─────────────────────────────────────────────────────────
  *                    PUBLIC API
  * ───────────────────────────────────────────────────────── */
 module.exports = {
   /** Write buffer (or folder marker) */
   async write(key, buffer) {
     await s3.putObject({ Bucket: BUCKET, Key: sanitize(key), Body: buffer }).promise();
   },
 
   /** Read object → Buffer */
   async read(key) {
     const { Body } = await s3.getObject({ Bucket: BUCKET, Key: sanitize(key) }).promise();
     return Body;
   },
 
   /** Stat object → returns S3 HEAD response (Size, etc.) */
   async stat(key) {
     return s3.headObject({ Bucket: BUCKET, Key: sanitize(key) }).promise();
   },
 
   /** List one “level” under prefix (excludes cache) */
   async list(prefix) {
     const Prefix = sanitize(prefix).replace(/\/?$/, '/');
 
     const res = await s3
       .listObjectsV2({ Bucket: BUCKET, Prefix, Delimiter: '/' })
       .promise();
 
     const dirs = (res.CommonPrefixes || []).map(cp => ({
       path : cp.Prefix,
       isDir: true
     }));
 
     const files = (res.Contents || [])
       .filter(obj => obj.Key !== Prefix)
       .filter(obj => !isCacheFile(obj.Key))
       .map(obj => ({ path: obj.Key, isDir: obj.Key.endsWith('/') }));
 
     return [...dirs, ...files];
   },
 
   /**
    * Recursively list **all** objects under prefix.
    * @param {string}  prefix
    * @param {boolean} includeCache  – include *.chunks.json if true
    */
   async listAll(prefix, includeCache = false) {
     const Prefix = sanitize(prefix).replace(/\/?$/, '/');
     let ContinuationToken = null;
     const items = [];
 
     do {
       const res = await s3
         .listObjectsV2({ Bucket: BUCKET, Prefix, ContinuationToken })
         .promise();
 
       for (const obj of res.Contents) {
         if (!includeCache && isCacheFile(obj.Key)) continue;
         items.push({ path: obj.Key, isDir: obj.Key.endsWith('/') });
       }
       ContinuationToken = res.IsTruncated ? res.NextContinuationToken : null;
     } while (ContinuationToken);
 
     return items;
   },
 
   /** Delete object */
   async delete(key) {
     await s3.deleteObject({ Bucket: BUCKET, Key: sanitize(key) }).promise();
   },
 };
 