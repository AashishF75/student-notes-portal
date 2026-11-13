import React, { useState } from 'react';
import {
  FolderKanban,
  FileText,
  PlusCircle,
  ArrowRight,
  BookMarked,
  Trash2,
  Edit2,
  Layers,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { createSubject, deleteSubject, updateSubject } from '../services/api';

const SubjectList = ({
  subjects,
  loading,
  error,
  refreshSubjects,
  onSelectSubject,
  userRole,
  showNotification
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentSubjectId, setCurrentSubjectId] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const openAddModal = () => {
    setEditMode(false);
    setCurrentSubjectId(null);
    setFormData({ name: '', code: '', description: '' });
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (subject, e) => {
    e.stopPropagation();
    setEditMode(true);
    setCurrentSubjectId(subject._id);
    setFormData({
      name: subject.name,
      code: subject.code,
      description: subject.description || ''
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleDeleteSubject = async (subject, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${subject.name}" (${subject.code})?`)) {
      return;
    }

    try {
      await deleteSubject(subject._id);
      showNotification(`Subject "${subject.name}" deleted successfully.`, 'success');
      refreshSubjects();
    } catch (err) {
      showNotification(err.message || 'Failed to delete subject', 'error');
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim() || !formData.code.trim()) {
      setFormError('Subject Name and Subject Code are both required.');
      return;
    }

    setSubmitting(true);
    try {
      if (editMode) {
        await updateSubject(currentSubjectId, formData);
        showNotification('Subject updated successfully', 'success');
      } else {
        await createSubject(formData);
        showNotification('New subject created successfully', 'success');
      }
      setModalOpen(false);
      refreshSubjects();
    } catch (err) {
      setFormError(err.message || 'Failed to save subject.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="subjects-page">
      {/* Header Bar */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Curriculum Subjects</h1>
          <p className="page-subtitle">
            Browse course modules by subject code to discover notes, study guides, and assignment solutions.
          </p>
        </div>

        {userRole === 'faculty' && (
          <button onClick={openAddModal} className="btn btn-primary">
            <PlusCircle size={18} />
            <span>Add New Subject</span>
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="state-panel loading-panel">
          <Loader2 className="spinner" size={36} />
          <p>Loading curriculum subjects from database...</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="state-panel error-panel">
          <AlertCircle size={36} />
          <h3>Unable to Load Subjects</h3>
          <p>{error}</p>
          <button onClick={refreshSubjects} className="btn btn-secondary mt-3">
            Retry Connection
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && subjects.length === 0 && (
        <div className="state-panel empty-panel">
          <FolderKanban size={48} />
          <h3>No Subjects Registered Yet</h3>
          <p>Subjects will appear here once seeded or created by faculty.</p>
          {userRole === 'faculty' && (
            <button onClick={openAddModal} className="btn btn-primary mt-3">
              <PlusCircle size={18} />
              <span>Create First Subject</span>
            </button>
          )}
        </div>
      )}

      {/* Subject Cards Grid */}
      {!loading && !error && subjects.length > 0 && (
        <div className="subjects-grid">
          {subjects.map((subj) => (
            <div
              key={subj._id}
              className="subject-card"
              onClick={() => onSelectSubject(subj._id)}
            >
              <div className="subject-card-top">
                <div className="subject-icon-box">
                  <Layers size={22} />
                </div>
                <div className="subject-badge-group">
                  <span className="code-pill">{subj.code}</span>
                  <span className="notes-badge">
                    <FileText size={14} />
                    <span>{subj.notesCount || 0} Notes</span>
                  </span>
                </div>
              </div>

              <div className="subject-card-body">
                <h3 className="subject-name">{subj.name}</h3>
                <p className="subject-desc">
                  {subj.description || 'Access complete lecture notes, tutorials, and semester resources.'}
                </p>
              </div>

              <div className="subject-card-bottom">
                <span className="view-notes-link">
                  <span>View Notes</span>
                  <ArrowRight size={16} />
                </span>

                {userRole === 'faculty' && (
                  <div className="faculty-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="icon-btn-edit"
                      onClick={(e) => openEditModal(subj, e)}
                      title="Edit Subject"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      className="icon-btn-delete"
                      onClick={(e) => handleDeleteSubject(subj, e)}
                      title={subj.notesCount > 0 ? "Cannot delete: notes attached" : "Delete Subject"}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Subject Modal (for Faculty) */}
      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editMode ? 'Edit Subject' : 'Register New Subject'}</h3>
              <button
                className="modal-close-btn"
                onClick={() => setModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="modal-form">
              {formError && (
                <div className="form-alert error-alert">
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="modalSubjName">Subject Name *</label>
                <input
                  id="modalSubjName"
                  type="text"
                  placeholder="e.g. Artificial Intelligence & Expert Systems"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="modalSubjCode">Subject Code *</label>
                <input
                  id="modalSubjCode"
                  type="text"
                  placeholder="e.g. CS307"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="form-input text-uppercase"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="modalSubjDesc">Subject Description</label>
                <textarea
                  id="modalSubjDesc"
                  rows="3"
                  placeholder="Brief overview of course modules and learning objectives..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="form-textarea"
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editMode ? 'Update Subject' : 'Create Subject'}</span>
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

export default SubjectList;

