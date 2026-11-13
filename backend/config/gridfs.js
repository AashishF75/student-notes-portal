const mongoose = require('mongoose');
const { PassThrough } = require('stream');

let bucketInstance = null;

/**
 * Returns the GridFSBucket instance tied to the active Mongoose database connection.
 */
function getGridFSBucket() {
  if (!bucketInstance) {
    if (mongoose.connection.readyState !== 1) {
      throw new Error('Database is not connected. Cannot initialize GridFSBucket.');
    }
    bucketInstance = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'pdfs'
    });
  }
  return bucketInstance;
}

/**
 * Uploads a binary Buffer directly into MongoDB GridFS.
 * @param {Buffer} buffer - File buffer from Multer memoryStorage
 * @param {string} originalName - Original file name
 * @param {object} metadata - Optional metadata (uploadedBy, subject, etc.)
 * @returns {Promise<{ gridFsFileId: ObjectId, fileName: string, fileSize: number }>}
 */
function uploadBufferToGridFS(buffer, originalName, metadata = {}) {
  return new Promise((resolve, reject) => {
    const bucket = getGridFSBucket();
    const cleanFileName = (originalName || 'document.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const storedFileName = `note-${uniqueSuffix}-${cleanFileName}`;

    const uploadStream = bucket.openUploadStream(storedFileName, {
      contentType: 'application/pdf',
      metadata: {
        originalName: originalName,
        uploadedAt: new Date(),
        ...metadata
      }
    });

    const passThrough = new PassThrough();
    passThrough.end(buffer);

    passThrough.pipe(uploadStream)
      .on('error', (err) => {
        console.error('[GridFS Upload Error]', err.message);
        reject(err);
      })
      .on('finish', (file) => {
        resolve({
          gridFsFileId: uploadStream.id,
          fileName: originalName,
          storedFileName: storedFileName,
          fileSize: buffer.length
        });
      });
  });
}

/**
 * Deletes a file from MongoDB GridFS by its ObjectId.
 * @param {string|ObjectId} gridFsFileId
 */
async function deleteFromGridFS(gridFsFileId) {
  if (!gridFsFileId) return;
  try {
    const bucket = getGridFSBucket();
    const objectId = typeof gridFsFileId === 'string'
      ? new mongoose.Types.ObjectId(gridFsFileId)
      : gridFsFileId;

    // Check if file exists in GridFS before deleting
    const files = await bucket.find({ _id: objectId }).toArray();
    if (files.length > 0) {
      await bucket.delete(objectId);
      console.log(`[GridFS] Deleted file from GridFS: ${objectId}`);
    } else {
      console.log(`[GridFS] File ID ${objectId} not found in GridFS (already deleted or cleaned up).`);
    }
  } catch (err) {
    console.warn(`[GridFS Warning] Failed to delete file ${gridFsFileId}: ${err.message}`);
  }
}

/**
 * Opens a readable download stream for a GridFS file.
 * @param {string|ObjectId} gridFsFileId
 */
function getGridFSDownloadStream(gridFsFileId) {
  const bucket = getGridFSBucket();
  const objectId = typeof gridFsFileId === 'string'
    ? new mongoose.Types.ObjectId(gridFsFileId)
    : gridFsFileId;
  return bucket.openDownloadStream(objectId);
}

/**
 * Fetches file metadata from GridFS (pdfs.files).
 * @param {string|ObjectId} gridFsFileId
 */
async function getGridFSFileInfo(gridFsFileId) {
  if (!gridFsFileId) return null;
  const bucket = getGridFSBucket();
  const objectId = typeof gridFsFileId === 'string'
    ? new mongoose.Types.ObjectId(gridFsFileId)
    : gridFsFileId;
  const files = await bucket.find({ _id: objectId }).toArray();
  return files[0] || null;
}

module.exports = {
  getGridFSBucket,
  uploadBufferToGridFS,
  deleteFromGridFS,
  getGridFSDownloadStream,
  getGridFSFileInfo
};

