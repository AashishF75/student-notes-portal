const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  uploadBufferToGridFS,
  deleteFromGridFS,
  getGridFSDownloadStream,
  getGridFSFileInfo
} = require('../config/gridfs');

// Memory storage engine: keeps incoming file in buffer (under 10MB limit)
const storage = multer.memoryStorage();

// PDF file filter: strictly accept PDF files
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimes = [
    'application/pdf',
    'application/x-pdf',
    'application/acrobat',
    'applications/vnd.pdf'
  ];

  if (ext === '.pdf' && (allowedMimes.includes(file.mimetype) || file.mimetype.includes('pdf'))) {
    cb(null, true);
  } else {
    const err = new Error('Invalid file type. Only PDF documents (.pdf) are allowed.');
    err.code = 'INVALID_FILE_TYPE';
    cb(err, false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB maximum limit
  },
  fileFilter: fileFilter
});

/**
 * Uploads a Multer memory buffer directly into MongoDB GridFS.
 */
const processUploadedFile = async (reqFile, req, metadata = {}) => {
  if (!reqFile || !reqFile.buffer) return null;

  const result = await uploadBufferToGridFS(reqFile.buffer, reqFile.originalname, metadata);

  // Return GridFS metadata
  return {
    gridFsFileId: result.gridFsFileId,
    fileName: result.fileName,
    fileSize: result.fileSize,
    storedFileName: result.storedFileName
  };
};

/**
 * Clean up stored file when note is deleted or replaced.
 * Deletes from MongoDB GridFS. Also unlinks local file if legacy file was on disk.
 */
const deleteStoredFile = async (note) => {
  if (!note) return;

  // 1. Delete from MongoDB GridFS
  if (note.gridFsFileId) {
    await deleteFromGridFS(note.gridFsFileId);
  }

  // 2. Legacy local file cleanup if present
  if (note.localFileName) {
    try {
      const localPath = path.join(__dirname, '..', 'uploads', note.localFileName);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        console.log(`[Storage] Unlinked legacy local file: ${note.localFileName}`);
      }
    } catch (err) {
      console.warn(`[Storage Warning] Failed to delete local file: ${err.message}`);
    }
  }
};

/**
 * No-op for memory storage cleanup, but preserved for error middleware compatibility
 */
const cleanupTempFile = () => {};

const uploadDir = path.join(__dirname, '..', 'uploads');

module.exports = {
  upload,
  processUploadedFile,
  deleteStoredFile,
  cleanupTempFile,
  uploadDir
};
