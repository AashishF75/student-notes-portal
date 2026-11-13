import React from 'react';
import {
  BookOpen,
  UploadCloud,
  Search,
  FolderKanban,
  FileText,
  ShieldCheck,
  Download,
  Users,
  ArrowRight,
  Sparkles
} from 'lucide-react';

const Home = ({ setActiveTab, subjects = [], notes = [], setSelectedSubject, setSearchTerm, userRole, setUserRole }) => {
  const [heroSearch, setHeroSearch] = React.useState('');

  const handleHeroSearchSubmit = (e) => {
    e.preventDefault();
    if (heroSearch.trim()) {
      setSearchTerm(heroSearch.trim());
      setActiveTab('notes');
    }
  };

  const handleSelectSubjectQuick = (subjectId) => {
    setSelectedSubject(subjectId);
    setActiveTab('notes');
  };

  const totalDownloads = notes.reduce((acc, note) => acc + (note.downloadsCount || 0), 0);

  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={16} />
            <span>Official College Notes Repository</span>
          </div>

          <h1 className="hero-title">
            Centralized Academic Notes &amp; Learning Portal
          </h1>

          <p className="hero-subtitle">
            Access verified lecture notes, course slides, and syllabus guides curated directly by college faculty. Search across subjects, preview inline, and download high-quality PDF resources seamlessly.
          </p>

          {/* Hero Search Box */}
          <form className="hero-search-form" onSubmit={handleHeroSearchSubmit}>
            <div className="hero-search-wrapper">
              <Search className="hero-search-icon" size={20} />
              <input
                type="text"
                placeholder="Search notes by title (e.g. Subnetting, Regression, Tree Rotations)..."
                value={heroSearch}
                onChange={(e) => setHeroSearch(e.target.value)}
                className="hero-search-input"
              />
              <button type="submit" className="hero-search-btn">
                Find Notes
              </button>
            </div>
          </form>

          {/* CTA Action Buttons */}
          <div className="hero-cta-group">
            <button
              onClick={() => setActiveTab('subjects')}
              className="btn btn-primary btn-lg"
            >
              <FolderKanban size={20} />
              <span>Explore Subjects</span>
              <ArrowRight size={18} />
            </button>

            <button
              onClick={() => {
                setUserRole('faculty');
                setActiveTab('upload');
              }}
              className="btn btn-secondary btn-lg"
            >
              <UploadCloud size={20} />
              <span>Upload Notes (Faculty)</span>
            </button>
          </div>
        </div>

        {/* Hero Visual Card / Statistics */}
        <div className="hero-stats-panel">
          <div className="stats-card">
            <div className="stats-header">
              <h3>Academic Overview</h3>
              <span className="live-indicator">
                <span className="live-dot"></span> Live Data
              </span>
            </div>

            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-icon-wrapper bg-blue">
                  <FolderKanban size={24} />
                </div>
                <div className="stat-data">
                  <span className="stat-number">{subjects.length}</span>
                  <span className="stat-label">Core Subjects</span>
                </div>
              </div>

              <div className="stat-box">
                <div className="stat-icon-wrapper bg-indigo">
                  <FileText size={24} />
                </div>
                <div className="stat-data">
                  <span className="stat-number">{notes.length}</span>
                  <span className="stat-label">PDF Notes Uploaded</span>
                </div>
              </div>

              <div className="stat-box">
                <div className="stat-icon-wrapper bg-green">
                  <Download size={24} />
                </div>
                <div className="stat-data">
                  <span className="stat-number">{totalDownloads}</span>
                  <span className="stat-label">Student Downloads</span>
                </div>
              </div>

              <div className="stat-box">
                <div className="stat-icon-wrapper bg-purple">
                  <Users size={24} />
                </div>
                <div className="stat-data">
                  <span className="stat-number">Faculty</span>
                  <span className="stat-label">Verified Publishers</span>
                </div>
              </div>
            </div>

            {/* Role Notice Card */}
            <div className="role-status-banner">
              <div className="role-status-text">
                <strong>Current Active Mode:</strong> {userRole === 'faculty' ? 'Faculty Member (Uploads & Edits Enabled)' : 'Student Learner (Read & Download Mode)'}
              </div>
              <button
                onClick={() => setUserRole(userRole === 'student' ? 'faculty' : 'student')}
                className="role-switch-link"
              >
                Switch to {userRole === 'student' ? 'Faculty Mode' : 'Student View'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Subjects Strip */}
      <section className="featured-subjects-section">
        <div className="section-header">
          <div>
            <h2 className="section-title">Browse Core Subjects</h2>
            <p className="section-subtitle">Select a subject to instantly view syllabus-aligned study materials</p>
          </div>
          <button onClick={() => setActiveTab('subjects')} className="btn-link">
            View All Subjects ({subjects.length}) &rarr;
          </button>
        </div>

        <div className="subjects-preview-grid">
          {subjects.slice(0, 4).map((subj) => (
            <div
              key={subj._id}
              className="subject-preview-card"
              onClick={() => handleSelectSubjectQuick(subj._id)}
            >
              <div className="subject-preview-header">
                <span className="subject-code-pill">{subj.code}</span>
                <span className="notes-counter-badge">{subj.notesCount || 0} notes</span>
              </div>
              <h3 className="subject-preview-title">{subj.name}</h3>
              <p className="subject-preview-desc">
                {subj.description || 'Verified course modules, lecture slides and assignment guides.'}
              </p>
              <div className="subject-preview-footer">
                <span className="action-text">Explore Notes</span>
                <ArrowRight size={16} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Value Pillars Section */}
      <section className="features-section">
        <h2 className="section-title text-center">Engineered for Academic Excellence</h2>
        <p className="section-subtitle text-center">A comprehensive, modern workflow for both students and faculty</p>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon bg-blue">
              <BookOpen size={24} />
            </div>
            <h3>Structured Curriculum</h3>
            <p>Every note is linked to verified course subjects and codes, eliminating cluttered shared drives and dead links.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon bg-indigo">
              <ShieldCheck size={24} />
            </div>
            <h3>Faculty Verified</h3>
            <p>Direct upload controls for teaching staff ensure all materials are syllabus-accurate, up to date, and authentic.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon bg-green">
              <Download size={24} />
            </div>
            <h3>Instant PDF Preview</h3>
            <p>Open notes directly inside browser tabs or download them locally for offline study sessions on any device.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;

