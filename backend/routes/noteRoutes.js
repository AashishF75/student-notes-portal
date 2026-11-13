const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Note = require('../models/Note');
const Subject = require('../models/Subject');
const {
  upload,
  processUploadedFile,
  deleteStoredFile,
  uploadDir
} = require('../middleware/upload');
const {
  getGridFSDownloadStream,
  getGridFSFileInfo
} = require('../config/gridfs');

// @route   GET /api/notes
// @desc    Get all notes (with filtering and search)
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const { subject, search, sort = '-createdAt' } = req.query;

    let query = {};

    // Filter by subject ID
    if (subject && subject !== 'all') {
      query.subject = subject;
    }

    // Search by title, description, or faculty name
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { description: searchRegex },
        { uploadedBy: searchRegex }
      ];
    }

    const notes = await Note.find(query)
      .populate('subject', 'name code')
      .sort(sort)
      .lean();

    // Ensure fileUrl is set to the GridFS stream endpoint if relative
    const notesWithFileUrl = notes.map(note => ({
      ...note,
      fileUrl: note.fileUrl || `/api/notes/${note._id}/file`
    }));

    res.status(200).json({
      success: true,
      count: notesWithFileUrl.length,
      data: notesWithFileUrl
    });
  } catch (err) {
    next(err);
  }
});

// @route   GET /api/notes/:id
// @desc    Get single note by ID
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id).populate('subject', 'name code description');

    if (!note) {
      return res.status(404).json({
        success: false,
        error: `Note not found with id: ${req.params.id}`
      });
    }

    const noteObj = note.toObject();
    noteObj.fileUrl = noteObj.fileUrl || `/api/notes/${note._id}/file`;

    res.status(200).json({
      success: true,
      data: noteObj
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/notes
// @desc    Upload new PDF note into MongoDB GridFS
// @access  Faculty / Public
router.post('/', upload.single('pdfFile'), async (req, res, next) => {
  try {
    const { title, description, subject, uploadedBy } = req.body;

    // Field validations
    if (!title || !description || !subject || !uploadedBy) {
      return res.status(400).json({
        success: false,
        error: 'Please provide all required fields: title, description, subject, and uploadedBy'
      });
    }

    // Check if file was provided
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please upload a PDF file for the note'
      });
    }

    // Verify subject exists
    const subjectExists = await Subject.findById(subject);
    if (!subjectExists) {
      return res.status(400).json({
        success: false,
        error: 'Specified subject does not exist'
      });
    }

    // Process file storage: upload buffer directly to MongoDB GridFS
    const fileData = await processUploadedFile(req.file, req, {
      title: title.trim(),
      uploadedBy: uploadedBy.trim(),
      subjectCode: subjectExists.code
    });

    // Create note in database with reference to GridFS file
    const note = new Note({
      title: title.trim(),
      description: description.trim(),
      subject: subjectExists._id,
      uploadedBy: uploadedBy.trim(),
      gridFsFileId: fileData.gridFsFileId,
      fileName: fileData.fileName,
      fileSize: fileData.fileSize,
      fileUrl: `/api/notes/placeholder/file` // will update below
    });

    note.fileUrl = `/api/notes/${note._id}/file`;
    await note.save();

    // Populate subject before sending response
    const populatedNote = await Note.findById(note._id).populate('subject', 'name code');

    res.status(201).json({
      success: true,
      message: 'Note uploaded and stored in MongoDB GridFS successfully',
      data: populatedNote
    });
  } catch (err) {
    next(err);
  }
});

// @route   PUT /api/notes/:id
// @desc    Update note details and optionally replace PDF in GridFS
// @access  Faculty / Public
router.put('/:id', upload.single('pdfFile'), async (req, res, next) => {
  try {
    const { title, description, subject, uploadedBy } = req.body;

    let note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({
        success: false,
        error: `Note not found with id: ${req.params.id}`
      });
    }

    if (subject) {
      const subjectExists = await Subject.findById(subject);
      if (!subjectExists) {
        return res.status(400).json({
          success: false,
          error: 'Specified subject does not exist'
        });
      }
      note.subject = subjectExists._id;
    }

    if (title) note.title = title.trim();
    if (description) note.description = description.trim();
    if (uploadedBy) note.uploadedBy = uploadedBy.trim();

    // If replacement PDF is uploaded
    if (req.file) {
      // Delete old file from GridFS
      await deleteStoredFile(note);

      // Upload new file buffer to GridFS
      const fileData = await processUploadedFile(req.file, req, {
        title: note.title,
        uploadedBy: note.uploadedBy
      });

      note.gridFsFileId = fileData.gridFsFileId;
      note.fileName = fileData.fileName;
      note.fileSize = fileData.fileSize;
      note.fileUrl = `/api/notes/${note._id}/file`;
    }

    note.updatedAt = Date.now();
    await note.save();

    const updatedNote = await Note.findById(note._id).populate('subject', 'name code');

    res.status(200).json({
      success: true,
      message: 'Note updated successfully in MongoDB GridFS',
      data: updatedNote
    });
  } catch (err) {
    next(err);
  }
});

// @route   DELETE /api/notes/:id
// @desc    Delete note and associated PDF file from GridFS
// @access  Faculty / Public
router.delete('/:id', async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        error: `Note not found with id: ${req.params.id}`
      });
    }

    // Delete stored PDF from GridFS
    await deleteStoredFile(note);

    // Delete document from MongoDB
    await Note.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: `Note "${note.title}" and its GridFS file were successfully deleted`
    });
  } catch (err) {
    next(err);
  }
});

// @route   GET /api/notes/:id/file
// @desc    Stream PDF inline for browser preview from MongoDB GridFS
// @access  Public
router.get('/:id/file', async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    // 1. If stored in GridFS
    if (note.gridFsFileId) {
      const fileInfo = await getGridFSFileInfo(note.gridFsFileId);
      if (!fileInfo) {
        return res.status(404).json({
          success: false,
          error: 'PDF file not found in GridFS storage'
        });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(note.fileName || 'note.pdf')}"`);
      res.setHeader('Content-Length', fileInfo.length);
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      const downloadStream = getGridFSDownloadStream(note.gridFsFileId);
      downloadStream.on('error', (err) => {
        console.error('[GridFS Stream Error]', err.message);
        if (!res.headersSent) res.status(500).end();
      });
      return downloadStream.pipe(res);
    }

    // 2. Fallback to legacy local file if still present
    if (note.localFileName) {
      const filePath = path.join(uploadDir, note.localFileName);
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(note.fileName || 'note.pdf')}"`);
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        return fs.createReadStream(filePath).pipe(res);
      }
    }

    return res.status(404).json({
      success: false,
      error: 'PDF binary asset not found'
    });
  } catch (err) {
    next(err);
  }
});

// @route   GET /api/notes/:id/download
// @desc    Download note PDF as attachment from GridFS & track download count
// @access  Public
router.get('/:id/download', async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    // Increment downloads count
    note.downloadsCount = (note.downloadsCount || 0) + 1;
    await note.save();

    // 1. If stored in GridFS
    if (note.gridFsFileId) {
      const fileInfo = await getGridFSFileInfo(note.gridFsFileId);
      if (!fileInfo) {
        return res.status(404).json({
          success: false,
          error: 'PDF file not found in GridFS storage'
        });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(note.fileName || 'note.pdf')}"`);
      res.setHeader('Content-Length', fileInfo.length);

      const downloadStream = getGridFSDownloadStream(note.gridFsFileId);
      downloadStream.on('error', (err) => {
        console.error('[GridFS Download Stream Error]', err.message);
        if (!res.headersSent) res.status(500).end();
      });
      return downloadStream.pipe(res);
    }

    // 2. Fallback to legacy local file if still present
    if (note.localFileName) {
      const filePath = path.join(uploadDir, note.localFileName);
      if (fs.existsSync(filePath)) {
        return res.download(filePath, note.fileName || 'note.pdf');
      }
    }

    return res.status(404).json({
      success: false,
      error: 'PDF binary file not found'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
