import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Home from './components/Home';
import SubjectList from './components/SubjectList';
import NotesList from './components/NotesList';
import UploadNote from './components/UploadNote';
import Footer from './components/Footer';
import { getSubjects, getNotes } from './services/api';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import './style.css';

function App() {
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'subjects' | 'notes' | 'upload'
  const [userRole, setUserRole] = useState('student'); // 'student' | 'faculty'

  // Application Data States
  const [subjects, setSubjects] = useState([]);
  const [notes, setNotes] = useState([]);

  // Loading & Error States
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [subjectsError, setSubjectsError] = useState('');
  const [notesError, setNotesError] = useState('');

  // Filtering & Search States
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Toast Notification State
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Fetch all subjects from backend
  const fetchSubjectsData = useCallback(async () => {
    setLoadingSubjects(true);
    setSubjectsError('');
    try {
      const data = await getSubjects();
      setSubjects(data);
    } catch (err) {
      console.error('Failed to load subjects:', err);
      setSubjectsError(err.message || 'Unable to load subjects from server.');
    } finally {
      setLoadingSubjects(false);
    }
  }, []);

  // Fetch notes from backend based on filters
  const fetchNotesData = useCallback(async () => {
    setLoadingNotes(true);
    setNotesError('');
    try {
      const data = await getNotes({
        subject: selectedSubject,
        search: searchTerm
      });
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes:', err);
      setNotesError(err.message || 'Unable to load notes from server.');
    } finally {
      setLoadingNotes(false);
    }
  }, [selectedSubject, searchTerm]);

  // Initial load
  useEffect(() => {
    fetchSubjectsData();
  }, [fetchSubjectsData]);

  // Load notes whenever filter changes
  useEffect(() => {
    fetchNotesData();
  }, [fetchNotesData]);

  // Handler when clicking a subject card to navigate to notes
  const handleSelectSubject = (subjectId) => {
    setSelectedSubject(subjectId);
    setActiveTab('notes');
  };

  return (
    <div className="app-wrapper">
      {/* Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={userRole}
        setUserRole={setUserRole}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'home' && (
          <Home
            setActiveTab={setActiveTab}
            subjects={subjects}
            notes={notes}
            setSelectedSubject={setSelectedSubject}
            setSearchTerm={setSearchTerm}
            userRole={userRole}
            setUserRole={setUserRole}
          />
        )}

        {activeTab === 'subjects' && (
          <SubjectList
            subjects={subjects}
            loading={loadingSubjects}
            error={subjectsError}
            refreshSubjects={fetchSubjectsData}
            onSelectSubject={handleSelectSubject}
            userRole={userRole}
            showNotification={showNotification}
          />
        )}

        {activeTab === 'notes' && (
          <NotesList
            notes={notes}
            subjects={subjects}
            loading={loadingNotes}
            error={notesError}
            refreshNotes={() => {
              fetchNotesData();
              fetchSubjectsData();
            }}
            selectedSubject={selectedSubject}
            setSelectedSubject={setSelectedSubject}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            userRole={userRole}
            showNotification={showNotification}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'upload' && (
          <UploadNote
            subjects={subjects}
            refreshNotes={() => {
              fetchNotesData();
              fetchSubjectsData();
            }}
            setActiveTab={setActiveTab}
            showNotification={showNotification}
            userRole={userRole}
            setUserRole={setUserRole}
          />
        )}
      </main>

      {/* Toast Notification */}
      {notification && (
        <div className={`toast-notification ${notification.type}`}>
          {notification.type === 'success' ? (
            <CheckCircle2 size={20} className="text-success" />
          ) : (
            <AlertTriangle size={20} className="text-danger" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Footer */}
      <Footer setActiveTab={setActiveTab} />
    </div>
  );
}

export default App;

