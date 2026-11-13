import React from 'react';
import { BookOpen, Heart, Code2, Database, Server, Cpu } from 'lucide-react';

const Footer = ({ setActiveTab }) => {
  return (
    <footer className="portal-footer">
      <div className="footer-container">
        <div className="footer-top-grid">
          {/* Brand & mission */}
          <div className="footer-col brand-col">
            <div className="footer-brand" onClick={() => setActiveTab('home')}>
              <div className="brand-icon-wrapper-sm">
                <BookOpen size={20} />
              </div>
              <span className="footer-brand-title">NotesHub</span>
            </div>
            <p className="footer-mission-text">
              An institutional academic sharing portal developed to streamline lecture distribution, syllabus access, and verified faculty notes for engineering and science students.
            </p>
          </div>

          {/* Quick links */}
          <div className="footer-col">
            <h4 className="footer-col-title">Portal Navigation</h4>
            <ul className="footer-links-list">
              <li>
                <button onClick={() => setActiveTab('home')}>Home Dashboard</button>
              </li>
              <li>
                <button onClick={() => setActiveTab('subjects')}>Course Subjects</button>
              </li>
              <li>
                <button onClick={() => setActiveTab('notes')}>All Lecture Notes</button>
              </li>
              <li>
                <button onClick={() => setActiveTab('upload')}>Faculty Upload Desk</button>
              </li>
            </ul>
          </div>

          {/* Core subjects */}
          <div className="footer-col">
            <h4 className="footer-col-title">Curriculum Topics</h4>
            <ul className="footer-links-list">
              <li>Computer Networks (CS301)</li>
              <li>Machine Learning (CS302)</li>
              <li>Full Stack Development (CS303)</li>
              <li>Data Structures &amp; Algorithms (CS304)</li>
              <li>Database Management (CS305)</li>
            </ul>
          </div>

          {/* Architecture badges */}
          <div className="footer-col">
            <h4 className="footer-col-title">Engineered With</h4>
            <div className="tech-badges-grid">
              <span className="tech-pill">
                <Code2 size={13} /> React 18 + Vite
              </span>
              <span className="tech-pill">
                <Server size={13} /> Express + Node.js
              </span>
              <span className="tech-pill">
                <Database size={13} /> MongoDB Atlas
              </span>
              <span className="tech-pill">
                <Cpu size={13} /> Multer + Cloudinary
              </span>
            </div>
            <p className="footer-lab-credit">
              College Laboratory Examination Project &bull; Academic Year 2026
            </p>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <p className="footer-copy">
            &copy; {new Date().getFullYear()} Student Notes Sharing Portal. All rights reserved.
          </p>
          <p className="footer-subtext">
            Designed for high performance, reliability, and responsive accessibility.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

