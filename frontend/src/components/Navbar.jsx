import React, { useState } from 'react';
import {
  BookOpen,
  Home as HomeIcon,
  FolderKanban,
  FileText,
  UploadCloud,
  UserCheck,
  GraduationCap,
  Menu,
  X
} from 'lucide-react';

const Navbar = ({ activeTab, setActiveTab, userRole, setUserRole }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'home', label: 'Home', icon: HomeIcon },
    { id: 'subjects', label: 'Subjects', icon: FolderKanban },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'upload', label: 'Upload Note', icon: UploadCloud, facultyOnly: true }
  ];

  const handleNavClick = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  const toggleRole = () => {
    const nextRole = userRole === 'student' ? 'faculty' : 'student';
    setUserRole(nextRole);
    if (nextRole === 'student' && activeTab === 'upload') {
      setActiveTab('notes');
    }
  };

  return (
    <header className="navbar-header">
      <div className="navbar-container">
        {/* Brand / Logo */}
        <div className="navbar-brand" onClick={() => handleNavClick('home')}>
          <div className="brand-icon-wrapper">
            <BookOpen className="brand-icon" size={24} />
          </div>
          <div className="brand-text">
            <span className="brand-title">NotesHub</span>
            <span className="brand-subtitle">Student Academic Portal</span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="desktop-nav">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = activeTab === link.id;

            return (
              <button
                key={link.id}
                onClick={() => handleNavClick(link.id)}
                className={`nav-link-btn ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{link.label}</span>
                {link.facultyOnly && (
                  <span className="badge-faculty-tag">Faculty</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Role Switcher Pill */}
        <div className="navbar-actions">
          <div className="role-switcher-card">
            <button
              onClick={toggleRole}
              className={`role-toggle-btn ${userRole === 'faculty' ? 'faculty-active' : 'student-active'}`}
              title="Click to toggle between Student and Faculty modes"
            >
              {userRole === 'faculty' ? (
                <>
                  <UserCheck size={16} className="role-icon" />
                  <span className="role-label">Faculty Mode</span>
                  <span className="role-switch-hint">Switch</span>
                </>
              ) : (
                <>
                  <GraduationCap size={16} className="role-icon" />
                  <span className="role-label">Student View</span>
                  <span className="role-switch-hint">Switch</span>
                </>
              )}
            </button>
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            className="mobile-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileMenuOpen && (
        <div className="mobile-nav-menu">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = activeTab === link.id;

            return (
              <button
                key={link.id}
                onClick={() => handleNavClick(link.id)}
                className={`mobile-nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={20} />
                <span>{link.label}</span>
                {link.facultyOnly && (
                  <span className="badge-faculty-tag">Faculty</span>
                )}
              </button>
            );
          })}

          <div className="mobile-role-container">
            <span className="mobile-role-label">Current Role:</span>
            <button
              onClick={toggleRole}
              className={`role-toggle-btn ${userRole === 'faculty' ? 'faculty-active' : 'student-active'}`}
            >
              {userRole === 'faculty' ? 'Faculty Mode (Switch to Student)' : 'Student View (Switch to Faculty)'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;

