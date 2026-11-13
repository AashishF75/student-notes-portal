import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  FileCheck,
  UserCheck,
  FolderKanban,
  ArrowRight
} from 'lucide-react';
import { uploadNote } from '../services/api';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

const UploadNote = ({
  subjects,
  refreshNotes,
  setActiveTab,
  showNotification,
  userRole,
  setUserRole
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    facultyName: '',
    subjectId: ''
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [lastUploadedNote, setLastUploadedNote] = useState(null);

  const fileInputRef = useRef(null);

  // Validate and set file
  const handleFileValidation = (file) => {
    setErrorMessage('');
    if (!file) return;

    // Check extension and MIME
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    if (!isPdf) {
      setErrorMessage('Invalid file format. Please upload a PDF file (.pdf) only.');
      setSelectedFile(null);
      return;
    }

    // Check size limit (10MB)
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maximum allowed size is 10 MB.`
      );
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileValidation(e.target.files[0]);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileValidation(e.dataTransfer.files[0]);
    }
  };

  // Form submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    // Comprehensive client-side validations
    if (!formData.title.trim()) {
      setErrorMessage('Please provide a descriptive title for the note.');
      return;
    }

    if (!formData.description.trim()) {
      setErrorMessage('Please enter a brief overview or summary of the notes.');
      return;
    }

    if (!formData.facultyName.trim()) {
      setErrorMessage('Please enter the name of the faculty member / instructor.');
      return;
    }

    if (!formData.subjectId) {
      setErrorMessage('Please select the corresponding course subject from the dropdown.');
      return;
    }

    if (!selectedFile) {
      setErrorMessage('Please select or drag & drop a PDF document to upload.');
      return;
    }

    setUploading(true);

    try {
      const payload = new FormData();
      payload.append('title', formData.title.trim());
      payload.append('description', formData.description.trim());
      payload.append('uploadedBy', formData.facultyName.trim());
      payload.append('subject', formData.subjectId);
      payload.append('pdfFile', selectedFile);

      const response = await uploadNote(payload);

      setUploadSuccess(true);
      setLastUploadedNote(response.data);
      showNotification('Note uploaded successfully and published to portal!', 'success');

      // Refresh notes list in parent state
      refreshNotes();

      // Reset form fields
      setFormData({
        title: '',
        description: '',
        facultyName: formData.facultyName, // keep faculty name for convenience
        subjectId: ''
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setErrorMessage(err.message || 'An error occurred during file upload. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="upload-page">
      {/* Header Bar */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Upload Faculty Lecture Notes</h1>
          <p className="page-subtitle">
            Publish syllabus-aligned lecture slides, lab manuals, and revision guides directly to students.
          </p>
        </div>
      </div>

      {/* Role Switch Banner if Student */}
      {userRole === 'student' && (
        <div className="role-warning-banner">
          <AlertCircle size={20} className="warning-icon" />
          <div className="warning-text">
            <strong>Viewing in Student Mode:</strong> The upload portal is designed for faculty and teaching staff.
          </div>
          <button
            onClick={() => setUserRole('faculty')}
            className="btn btn-sm btn-primary ml-auto"
          >
            Switch to Faculty Mode
          </button>
        </div>
      )}

      <div className="upload-layout-grid">
        {/* Upload Form Box */}
        <div className="upload-form-card">
          {/* Upload Success Alert */}
          {uploadSuccess && (
            <div className="upload-success-box">
              <div className="success-header">
                <CheckCircle size={28} className="success-icon" />
                <div>
                  <h4>Note Published Successfully!</h4>
                  <p>Students can now view, search, and download this PDF resource.</p>
                </div>
              </div>

              {lastUploadedNote && (
                <div className="uploaded-note-preview">
                  <strong>{lastUploadedNote.title}</strong>
                  <span>
                    Subject: {lastUploadedNote.subject?.code} - {lastUploadedNote.subject?.name}
                  </span>
                </div>
              )}

              <div className="success-actions">
                <button
                  onClick={() => setUploadSuccess(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Upload Another Note
                </button>
                <button
                  onClick={() => setActiveTab('notes')}
                  className="btn btn-primary btn-sm"
                >
                  <span>Go to Notes List</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {errorMessage && (
            <div className="form-alert error-alert">
              <AlertCircle size={20} className="alert-icon" />
              <div className="alert-body">
                <strong>Upload Error</strong>
                <p>{errorMessage}</p>
              </div>
              <button
                type="button"
                className="alert-close"
                onClick={() => setErrorMessage('')}
              >
                &times;
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="note-upload-form">
            {/* Note Title */}
            <div className="form-group">
              <label htmlFor="noteTitle">
                Note Title <span className="required-star">*</span>
              </label>
              <input
                id="noteTitle"
                type="text"
                placeholder="e.g. Unit 3 - B-Trees, B+ Trees &amp; Indexing Mechanisms"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="form-input"
                maxLength={150}
                required
              />
              <span className="input-char-count">{formData.title.length}/150</span>
            </div>

            {/* Subject Dropdown & Faculty Name Row */}
            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="noteSubject">
                  Course Subject <span className="required-star">*</span>
                </label>
                <select
                  id="noteSubject"
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  className="form-select"
                  required
                >
                  <option value="">-- Choose Subject --</option>
                  {subjects.map((subj) => (
                    <option key={subj._id} value={subj._id}>
                      {subj.code} — {subj.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="facultyName">
                  Faculty / Instructor Name <span className="required-star">*</span>
                </label>
                <input
                  id="facultyName"
                  type="text"
                  placeholder="e.g. Dr. Robert Miller"
                  value={formData.facultyName}
                  onChange={(e) => setFormData({ ...formData, facultyName: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
            </div>

            {/* Note Description */}
            <div className="form-group">
              <label htmlFor="noteDescription">
                Description &amp; Syllabus Coverage <span className="required-star">*</span>
              </label>
              <textarea
                id="noteDescription"
                rows="4"
                placeholder="Summarize key topics covered, chapter numbers, key formulas, or lab exercises..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="form-textarea"
                required
              />
            </div>

            {/* File Upload Drag & Drop Zone */}
            <div className="form-group">
              <label>
                PDF Document <span className="required-star">* (Max 10 MB)</span>
              </label>

              <div
                className={`dropzone-box ${dragActive ? 'drag-active' : ''} ${selectedFile ? 'has-file' : ''}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileChange}
                  className="hidden-file-input"
                />

                {!selectedFile ? (
                  <div className="dropzone-prompt">
                    <div className="dropzone-icon-circle">
                      <UploadCloud size={32} />
                    </div>
                    <p className="dropzone-title">
                      Click to browse or drag and drop your PDF here
                    </p>
                    <p className="dropzone-subtitle">
                      Strictly PDF files (.pdf) only up to 10 MB
                    </p>
                  </div>
                ) : (
                  <div className="selected-file-card" onClick={(e) => e.stopPropagation()}>
                    <div className="file-info-icon">
                      <FileCheck size={28} />
                    </div>
                    <div className="file-info-details">
                      <span className="selected-file-name">{selectedFile.name}</span>
                      <span className="selected-file-size">
                        {formatFileSize(selectedFile.size)} &bull; Ready to upload
                      </span>
                    </div>
                    <button
                      type="button"
                      className="file-remove-btn"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      title="Remove file"
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary btn-submit-upload"
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 size={20} className="spinner" />
                    <span>Validating &amp; Uploading PDF...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={20} />
                    <span>Upload &amp; Publish Notes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Guidelines Sidebar */}
        <div className="upload-guidelines-card">
          <h3>Faculty Submission Guidelines</h3>
          <ul className="guidelines-list">
            <li>
              <div className="guide-bullet">1</div>
              <div>
                <strong>Curriculum Alignment</strong>
                <p>Ensure documents correlate with current semester syllabus guidelines and course codes.</p>
              </div>
            </li>
            <li>
              <div className="guide-bullet">2</div>
              <div>
                <strong>Format Restrictions</strong>
                <p>Only standard Adobe PDF files (.pdf) are permitted. Scanned images must be compiled into a single PDF.</p>
              </div>
            </li>
            <li>
              <div className="guide-bullet">3</div>
              <div>
                <strong>File Size Ceiling</strong>
                <p>Maximum file limit is 10 MB per document. Compress large images before exporting.</p>
              </div>
            </li>
            <li>
              <div className="guide-bullet">4</div>
              <div>
                <strong>Persistent Cloud Storage</strong>
                <p>Files are backed by secure storage and CDN distribution for instant student access.</p>
              </div>
            </li>
          </ul>

          <div className="sidebar-quick-stats">
            <span className="stats-tip-title">Available Subjects:</span>
            <span className="stats-tip-value">{subjects.length} Course Codes</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadNote;

