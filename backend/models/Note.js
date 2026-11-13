const mongoose = require('mongoose');

const NoteSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Note title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters']
    },
    description: {
      type: String,
      required: [true, 'Note description is required'],
      trim: true
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subject',
      required: [true, 'Subject reference is required']
    },
    fileUrl: {
      type: String,
      required: [true, 'PDF file URL is required']
    },
    fileName: {
      type: String,
      required: [true, 'Original file name is required']
    },
    fileSize: {
      type: Number,
      default: 0
    },
    gridFsFileId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true
    },
    cloudinaryPublicId: {
      type: String,
      default: null
    },
    localFileName: {
      type: String,
      default: null
    },
    uploadedBy: {
      type: String,
      required: [true, 'Faculty name is required'],
      trim: true
    },
    downloadsCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Index for search optimization
NoteSchema.index({ title: 'text', description: 'text' });
NoteSchema.index({ subject: 1 });

module.exports = mongoose.model('Note', NoteSchema);

