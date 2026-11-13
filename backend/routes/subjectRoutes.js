const express = require('express');
const router = express.Router();
const Subject = require('../models/Subject');
const Note = require('../models/Note');

// @route   GET /api/subjects
// @desc    Get all subjects with note counts
// @access  Public
router.get('/', async (req, res, next) => {
  try {
    const subjects = await Subject.find().sort({ name: 1 }).lean();

    // Calculate notes count for each subject
    const subjectsWithCount = await Promise.all(
      subjects.map(async (subj) => {
        const count = await Note.countDocuments({ subject: subj._id });
        return {
          ...subj,
          notesCount: count
        };
      })
    );

    res.status(200).json({
      success: true,
      count: subjectsWithCount.length,
      data: subjectsWithCount
    });
  } catch (err) {
    next(err);
  }
});

// @route   GET /api/subjects/:id
// @desc    Get single subject by ID
// @access  Public
router.get('/:id', async (req, res, next) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({
        success: false,
        error: `Subject not found with id: ${req.params.id}`
      });
    }

    const notesCount = await Note.countDocuments({ subject: subject._id });

    res.status(200).json({
      success: true,
      data: {
        ...subject.toObject(),
        notesCount
      }
    });
  } catch (err) {
    next(err);
  }
});

// @route   POST /api/subjects
// @desc    Create new subject
// @access  Faculty / Public
router.post('/', async (req, res, next) => {
  try {
    const { name, code, description } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        error: 'Please provide both subject name and subject code'
      });
    }

    // Check if subject code already exists
    const existing = await Subject.findOne({ code: code.trim().toUpperCase() });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Subject with code ${code.toUpperCase()} already exists.`
      });
    }

    const subject = await Subject.create({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description ? description.trim() : ''
    });

    res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      data: subject
    });
  } catch (err) {
    next(err);
  }
});

// @route   PUT /api/subjects/:id
// @desc    Update subject
// @access  Faculty / Public
router.put('/:id', async (req, res, next) => {
  try {
    const { name, code, description } = req.body;

    let subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({
        success: false,
        error: `Subject not found with id: ${req.params.id}`
      });
    }

    if (code && code.trim().toUpperCase() !== subject.code) {
      const codeTaken = await Subject.findOne({
        code: code.trim().toUpperCase(),
        _id: { $ne: req.params.id }
      });
      if (codeTaken) {
        return res.status(409).json({
          success: false,
          error: `Subject code ${code.toUpperCase()} is already in use.`
        });
      }
      subject.code = code.trim().toUpperCase();
    }

    if (name) subject.name = name.trim();
    if (description !== undefined) subject.description = description.trim();

    await subject.save();

    res.status(200).json({
      success: true,
      message: 'Subject updated successfully',
      data: subject
    });
  } catch (err) {
    next(err);
  }
});

// @route   DELETE /api/subjects/:id
// @desc    Delete subject
// @access  Faculty / Public
router.delete('/:id', async (req, res, next) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({
        success: false,
        error: `Subject not found with id: ${req.params.id}`
      });
    }

    // Check if notes are attached to this subject
    const attachedNotesCount = await Note.countDocuments({ subject: subject._id });
    if (attachedNotesCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete subject "${subject.name}" because it has ${attachedNotesCount} note(s) attached. Please delete or reassign those notes first.`
      });
    }

    await Subject.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: `Subject "${subject.name}" deleted successfully`
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

