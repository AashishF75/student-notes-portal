import React from 'react';
import {
  FileText,
  Calendar,
  User,
  Download,
  ExternalLink,
  Trash2,
  Edit2,
  FileCheck2,
  HardDrive
} from 'lucide-react';
import { resolveFileUrl, getDownloadUrl } from '../services/api';

const NoteCard = ({
  note,
  userRole,
  onEditNote,
  onDeleteNote,
  onViewPdf
}) => {
  // Format readable upload date
  const formattedDate = note.createdAt
    ? new Date(note.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : 'Recent';

  // Format bytes to KB or MB
  const formatFileSize = (bytes) => {
    if (!bytes) return 'PDF Document';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const subjectName = note.subject?.name || 'General';
  const subjectCode = note.subject?.code || 'GEN';

  return (
    <article className="note-card">
      {/* Top Meta Header */}
      <div className="note-card-header">
        <div className="note-subject-tag">
          <span className="subject-tag-code">{subjectCode}</span>
          <span className="subject-tag-name">{subjectName}</span>
        </div>

        {/* Faculty quick action buttons */}
        {userRole === 'faculty' && (
          <div className="note-faculty-toolbar">
            <button
              onClick={() => onEditNote(note)}
              className="faculty-btn-edit"
              title="Edit Note Details"
            >
              <Edit2 size={15} />
            </button>
            <button
              onClick={() => onDeleteNote(note)}
              className="faculty-btn-delete"
              title="Delete Note and PDF"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="note-card-body">
        <h3 className="note-title" title={note.title}>
          {note.title}
        </h3>
        <p className="note-description">
          {note.description}
        </p>
      </div>

      {/* Metadata Chips: Faculty, Date, File Size, Downloads */}
      <div className="note-metadata-grid">
        <div className="metadata-item">
          <User size={14} className="meta-icon" />
          <span className="meta-text" title={`Uploaded by ${note.uploadedBy}`}>
            {note.uploadedBy || 'Faculty'}
          </span>
        </div>

        <div className="metadata-item">
          <Calendar size={14} className="meta-icon" />
          <span className="meta-text">{formattedDate}</span>
        </div>

        <div className="metadata-item">
          <HardDrive size={14} className="meta-icon" />
          <span className="meta-text">{formatFileSize(note.fileSize)}</span>
        </div>

        <div className="metadata-item">
          <FileCheck2 size={14} className="meta-icon" />
          <span className="meta-text">{note.downloadsCount || 0} downloads</span>
        </div>
      </div>

      {/* Action Buttons: View PDF & Download PDF */}
      <div className="note-card-footer">
        <button
          onClick={() => onViewPdf(note)}
          className="btn-action btn-view-pdf"
          title="Preview PDF Document in browser"
        >
          <ExternalLink size={16} />
          <span>View PDF</span>
        </button>

        <a
          href={getDownloadUrl(note._id)}
          download={note.fileName || 'note.pdf'}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-action btn-download-pdf"
          title="Download PDF file directly"
        >
          <Download size={16} />
          <span>Download</span>
        </a>
      </div>
    </article>
  );
};

export default NoteCard;

