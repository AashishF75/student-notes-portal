import React, { useState } from 'react';
import {
  Search,
  Filter,
  FileText,
  RotateCcw,
  LayoutGrid,
  Table as TableIcon,
  Download,
  ExternalLink,
  PlusCircle,
  AlertCircle,
  Loader2,
  Trash2,
  Edit2,
  X,
  FileUp
} from 'lucide-react';
import NoteCard from './NoteCard';
import { deleteNote, updateNote, getDownloadUrl, resolveFileUrl } from '../services/api';

const NotesList = ({
  notes,
  subjects,
  loading,
  error,
  refreshNotes,
  selectedSubject,
  setSelectedSubject,
  searchTerm,
  setSearchTerm,
  userRole,
  showNotification,
  setActiveTab
}) => {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [activePdfModal, setActivePdfModal] = useState(null); // note object for PDF preview
  const [editModalNote, setEditModalNote] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', uploadedBy: '', subject: '' });
  const [newPdfFile, setNewPdfFile] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState('');

  // Clear all filters
  const handleResetFilters = () => {
    setSelectedSubject('all');
    setSearchTerm('');
  };

  // Open Edit Note Modal
  const handleEditNote = (note) => {
    setEditModalNote(note);
    setEditForm({
      title: note.title,
      description: note.description,
      uploadedBy: note.uploadedBy,
      subject: note.subject?._id || note.subject || ''
    });
    setNewPdfFile(null);
    setEditError('');
  };

  // Submit Note Edit
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm.title.trim() || !editForm.description.trim() || !editForm.uploadedBy.trim()) {
      setEditError('Title, description, and faculty name are required.');
      return;
    }

    setUpdating(true);
    setEditError('');

    try {
      const formData = new FormData();
      formData.append('title', editForm.title.trim());
      formData.append('description', editForm.description.trim());
      formData.append('uploadedBy', editForm.uploadedBy.trim());
      if (editForm.subject) formData.append('subject', editForm.subject);
      if (newPdfFile) formData.append('pdfFile', newPdfFile);

      await updateNote(editModalNote._id, formData);
      showNotification('Note updated successfully!', 'success');
      setEditModalNote(null);
      refreshNotes();
    } catch (err) {
      setEditError(err.message || 'Failed to update note.');
    } finally {
      setUpdating(false);
    }
  };

  // Handle Note Deletion
  const handleDeleteNote = async (note) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${note.title}"? This will remove the file from storage.`)) {
      return;
    }

    try {
      await deleteNote(note._id);
      showNotification(`Note "${note.title}" deleted.`, 'success');
      refreshNotes();
    } catch (err) {
      showNotification(err.message || 'Failed to delete note.', 'error');
    }
  };

  // Open PDF viewer
  const handleViewPdf = (note) => {
    // Open in interactive viewer modal or new tab
    setActivePdfModal(note);
  };

  const currentSubjectObj = subjects.find(s => s._id === selectedSubject);

  return (
    <div className="notes-page">
      {/* Header Bar */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Lecture Notes &amp; Documents</h1>
          <p className="page-subtitle">
            {selectedSubject && selectedSubject !== 'all'
              ? `Filtered by ${currentSubjectObj?.name || 'Selected Subject'} (${currentSubjectObj?.code || ''})`
              : 'Browse all available curriculum study resources, searchable by title and filterable by subject.'}
          </p>
        </div>

        {userRole === 'faculty' && (
          <button onClick={() => setActiveTab('upload')} className="btn btn-primary">
            <PlusCircle size={18} />
            <span>Upload New Note</span>
          </button>
        )}
      </div>

      {/* Control Filter Bar */}
      <div className="controls-bar">
        {/* Search input */}
        <div className="search-box-wrapper">
          <Search className="search-icon" size={18} />
          <input
            type="text"
            placeholder="Search notes by title or keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="search-clear-btn"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Subject Filter Dropdown */}
        <div className="filter-dropdown-wrapper">
          <Filter size={16} className="filter-icon" />
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Subjects (Show All)</option>
            {subjects.map((s) => (
              <option key={s._id} value={s._id}>
                {s.code} - {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* View mode toggle (Grid vs Table) */}
        <div className="view-toggle-group">
          <button
            onClick={() => setViewMode('grid')}
            className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            title="Grid view"
          >
            <LayoutGrid size={18} />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            title="Table view"
          >
            <TableIcon size={18} />
          </button>
        </div>

        {/* Reset Filter Button */}
        {(selectedSubject !== 'all' || searchTerm) && (
          <button onClick={handleResetFilters} className="btn btn-secondary btn-sm">
            <RotateCcw size={14} />
            <span>Show All</span>
          </button>
        )}
      </div>

      {/* Active Filter Indicators */}
      {(selectedSubject !== 'all' || searchTerm) && (
        <div className="active-filters-chips">
          <span className="filters-label">Active Filters:</span>
          {selectedSubject !== 'all' && (
            <span className="filter-chip">
              Subject: {currentSubjectObj?.code || 'Selected'}
              <button onClick={() => setSelectedSubject('all')}>&times;</button>
            </span>
          )}
          {searchTerm && (
            <span className="filter-chip">
              Search: "{searchTerm}"
              <button onClick={() => setSearchTerm('')}>&times;</button>
            </span>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="state-panel loading-panel">
          <Loader2 className="spinner" size={36} />
          <p>Fetching notes from database...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="state-panel error-panel">
          <AlertCircle size={36} />
          <h3>Error Loading Notes</h3>
          <p>{error}</p>
          <button onClick={refreshNotes} className="btn btn-secondary mt-3">
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && notes.length === 0 && (
        <div className="state-panel empty-panel">
          <FileText size={48} />
          <h3>No Notes Found</h3>
          <p>
            {searchTerm || selectedSubject !== 'all'
              ? 'No notes match your current filter criteria. Try clearing the search or choosing another subject.'
              : 'No notes have been uploaded to the portal yet.'}
          </p>
          <div className="empty-actions">
            {(searchTerm || selectedSubject !== 'all') ? (
              <button onClick={handleResetFilters} className="btn btn-secondary">
                <RotateCcw size={16} />
                <span>Show All Notes</span>
              </button>
            ) : (
              userRole === 'faculty' && (
                <button onClick={() => setActiveTab('upload')} className="btn btn-primary">
                  <PlusCircle size={16} />
                  <span>Upload First Note</span>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* GRID VIEW */}
      {!loading && !error && notes.length > 0 && viewMode === 'grid' && (
        <div className="notes-grid">
          {notes.map((note) => (
            <NoteCard
              key={note._id}
              note={note}
              userRole={userRole}
              onEditNote={handleEditNote}
              onDeleteNote={handleDeleteNote}
              onViewPdf={handleViewPdf}
            />
          ))}
        </div>
      )}

      {/* TABLE VIEW (HTML5 / CSS3 Responsive Table) */}
      {!loading && !error && notes.length > 0 && viewMode === 'table' && (
        <div className="table-responsive-container">
          <table className="notes-data-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Note Title &amp; Description</th>
                <th>Faculty</th>
                <th>Date</th>
                <th>Downloads</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note._id}>
                  <td>
                    <span className="code-pill">{note.subject?.code || 'GEN'}</span>
                    <span className="table-subject-name">{note.subject?.name}</span>
                  </td>
                  <td>
                    <strong className="table-note-title">{note.title}</strong>
                    <p className="table-note-desc">{note.description}</p>
                  </td>
                  <td>{note.uploadedBy}</td>
                  <td className="whitespace-nowrap">
                    {note.createdAt ? new Date(note.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                  <td>{note.downloadsCount || 0}</td>
                  <td>
                    <div className="table-actions-cell">
                      <button
                        onClick={() => handleViewPdf(note)}
                        className="btn-action-sm btn-view-pdf"
                        title="View PDF"
                      >
                        <ExternalLink size={14} />
                        <span>View</span>
                      </button>

                      <a
                        href={getDownloadUrl(note._id)}
                        download={note.fileName || 'note.pdf'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-action-sm btn-download-pdf"
                        title="Download PDF"
                      >
                        <Download size={14} />
                        <span>Download</span>
                      </a>

                      {userRole === 'faculty' && (
                        <>
                          <button
                            onClick={() => handleEditNote(note)}
                            className="icon-btn-edit"
                            title="Edit Note"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note)}
                            className="icon-btn-delete"
                            title="Delete Note"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PDF PREVIEW MODAL */}
      {activePdfModal && (
        <div className="modal-backdrop">
          <div className="modal-content pdf-viewer-modal">
            <div className="modal-header">
              <div className="pdf-modal-title-box">
                <FileText size={20} className="text-primary" />
                <div>
                  <h3>{activePdfModal.title}</h3>
                  <span className="pdf-modal-subtitle">
                    {activePdfModal.subject?.code} - {activePdfModal.subject?.name} | Uploaded by {activePdfModal.uploadedBy}
                  </span>
                </div>
              </div>
              <div className="pdf-modal-actions">
                <a
                  href={getDownloadUrl(activePdfModal._id)}
                  download={activePdfModal.fileName || 'note.pdf'}
                  className="btn btn-primary btn-sm"
                >
                  <Download size={16} />
                  <span>Download PDF</span>
                </a>
                <button
                  className="modal-close-btn"
                  onClick={() => setActivePdfModal(null)}
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="pdf-viewer-frame-container">
              <iframe
                src={resolveFileUrl(activePdfModal.fileUrl)}
                title={activePdfModal.title}
                className="pdf-iframe"
                frameBorder="0"
              />
            </div>
          </div>
        </div>
      )}

      {/* EDIT NOTE MODAL (Faculty) */}
      {editModalNote && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Lecture Note</h3>
              <button
                className="modal-close-btn"
                onClick={() => setEditModalNote(null)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="modal-form">
              {editError && (
                <div className="form-alert error-alert">
                  <AlertCircle size={16} />
                  <span>{editError}</span>
                </div>
              )}

              <div className="form-group">
                <label>Note Title *</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label>Subject *</label>
                <select
                  value={editForm.subject}
                  onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                  className="form-select"
                  required
                >
                  {subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Faculty Name *</label>
                <input
                  type="text"
                  value={editForm.uploadedBy}
                  onChange={(e) => setEditForm({ ...editForm, uploadedBy: e.target.value })}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label>Note Description *</label>
                <textarea
                  rows="3"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="form-textarea"
                  required
                />
              </div>

              <div className="form-group">
                <label>Replace PDF Document (Optional)</label>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setNewPdfFile(e.target.files[0])}
                  className="form-file-input"
                />
                <span className="form-hint">
                  Leave empty to retain existing file: {editModalNote.fileName}
                </span>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setEditModalNote(null)}
                  className="btn btn-secondary"
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updating}
                >
                  {updating ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Update Note</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesList;

