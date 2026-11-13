const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Set port for test runner
process.env.PORT = '5001';
process.env.NODE_ENV = 'test';

const app = require('../server');

const BASE_URL = 'http://localhost:5001';

// Helper to make multipart request using built-in FormData
async function postMultipart(endpoint, fields, fileInfo, method = 'POST') {
  const formData = new FormData();
  for (const [key, val] of Object.entries(fields)) {
    formData.append(key, val);
  }
  if (fileInfo) {
    const fileBytes = fs.readFileSync(fileInfo.path);
    const blob = new Blob([fileBytes], { type: fileInfo.mimeType });
    formData.append('pdfFile', blob, fileInfo.filename);
  }
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: method,
    body: formData
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function runTests() {
  console.log('\n=============================================');
  console.log('   STARTING AUTOMATED BACKEND API TESTS      ');
  console.log('=============================================\n');

  let passed = 0;
  let failed = 0;
  const results = [];

  function record(name, isPass, detail = '') {
    if (isPass) {
      passed++;
      console.log(`[PASS] ${name} ${detail ? '(' + detail + ')' : ''}`);
      results.push({ name, status: 'PASS', detail });
    } else {
      failed++;
      console.error(`[FAIL] ${name} - ${detail}`);
      results.push({ name, status: 'FAIL', detail });
    }
  }

  // Create temporary test files
  const tmpDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const validPdfPath = path.join(tmpDir, 'test-doc.pdf');
  fs.writeFileSync(validPdfPath, '%PDF-1.4\n%Test valid PDF content\n%%EOF');

  const invalidTxtPath = path.join(tmpDir, 'test-doc.txt');
  fs.writeFileSync(invalidTxtPath, 'This is a plain text file, not a PDF!');

  const oversizedPdfPath = path.join(tmpDir, 'oversized.pdf');
  // 11 MB buffer
  const bigBuffer = Buffer.alloc(11 * 1024 * 1024, '%PDF-1.4\n');
  fs.writeFileSync(oversizedPdfPath, bigBuffer);

  let testSubjectId = null;
  let testNoteId = null;

  try {
    // 1. Health check
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    record('Health Check Endpoint', healthRes.status === 200 && healthData.status === 'online');

    // 2. GET all subjects
    const getSubjRes = await fetch(`${BASE_URL}/api/subjects`);
    const subjData = await getSubjRes.json();
    record('Get All Subjects', getSubjRes.status === 200 && Array.isArray(subjData.data) && subjData.data.length >= 5, `Found ${subjData.count} subjects`);

    // 3. POST new subject
    const newSubjRes = await fetch(`${BASE_URL}/api/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cyber Security Essentials',
        code: 'CS306',
        description: 'Cryptography, network defense, penetration testing, and secure coding.'
      })
    });
    const newSubjData = await newSubjRes.json();
    if (newSubjRes.status === 201 && newSubjData.data?._id) {
      testSubjectId = newSubjData.data._id;
      record('Create Subject (POST /api/subjects)', true, `ID: ${testSubjectId}`);
    } else if (newSubjRes.status === 409) {
      // Already exists, fetch it
      const existing = subjData.data.find(s => s.code === 'CS306');
      testSubjectId = existing?._id;
      record('Create Subject (POST /api/subjects)', true, 'Subject CS306 exists from previous run');
    } else {
      record('Create Subject (POST /api/subjects)', false, newSubjData.error);
    }

    // 4. GET single subject by ID
    const getSingleSubj = await fetch(`${BASE_URL}/api/subjects/${testSubjectId}`);
    const singleSubjData = await getSingleSubj.json();
    record('Get Subject by ID (GET /api/subjects/:id)', getSingleSubj.status === 200 && singleSubjData.data.code === 'CS306');

    // 5. PUT update subject
    const putSubjRes = await fetch(`${BASE_URL}/api/subjects/${testSubjectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Advanced Cyber Security & Defense',
        description: 'Updated description for advanced cybersecurity protocols.'
      })
    });
    const putSubjData = await putSubjRes.json();
    record('Update Subject (PUT /api/subjects/:id)', putSubjRes.status === 200 && putSubjData.data.name.includes('Advanced'));

    // 6. POST new note with valid PDF
    const uploadRes = await postMultipart(
      '/api/notes',
      {
        title: 'Network Penetration Testing Lab Manual',
        description: 'Step by step guide to Kali Linux, Nmap scans, Wireshark packet capture, and Metasploit fundamentals.',
        subject: testSubjectId,
        uploadedBy: 'Prof. Marcus Vance'
      },
      {
        path: validPdfPath,
        filename: 'network-pen-test-lab.pdf',
        mimeType: 'application/pdf'
      }
    );
    if (uploadRes.status === 201 && uploadRes.data.data?._id) {
      testNoteId = uploadRes.data.data._id;
      record('Upload Note with Valid PDF (POST /api/notes)', true, `Note ID: ${testNoteId}`);
    } else {
      record('Upload Note with Valid PDF (POST /api/notes)', false, JSON.stringify(uploadRes.data));
    }

    // 7. Reject invalid file type (.txt instead of .pdf)
    const rejectTypeRes = await postMultipart(
      '/api/notes',
      {
        title: 'Invalid File Note',
        description: 'Should be rejected because it is text not PDF',
        subject: testSubjectId,
        uploadedBy: 'Prof. Marcus Vance'
      },
      {
        path: invalidTxtPath,
        filename: 'notes.txt',
        mimeType: 'text/plain'
      }
    );
    record('Reject Non-PDF File (Validation)', rejectTypeRes.status === 400, rejectTypeRes.data.error);

    // 8. Reject oversized file (> 10MB)
    const rejectSizeRes = await postMultipart(
      '/api/notes',
      {
        title: 'Huge PDF Note',
        description: 'Should be rejected because size exceeds 10MB',
        subject: testSubjectId,
        uploadedBy: 'Prof. Marcus Vance'
      },
      {
        path: oversizedPdfPath,
        filename: 'huge-file.pdf',
        mimeType: 'application/pdf'
      }
    );
    record('Reject Oversized File (>10MB)', rejectSizeRes.status === 400, rejectSizeRes.data.error);

    // 9. GET all notes
    const getNotesRes = await fetch(`${BASE_URL}/api/notes`);
    const notesData = await getNotesRes.json();
    record('Get All Notes (GET /api/notes)', getNotesRes.status === 200 && notesData.data.length > 0, `Count: ${notesData.count}`);

    // 10. Filter notes by subject
    const filterSubjRes = await fetch(`${BASE_URL}/api/notes?subject=${testSubjectId}`);
    const filterSubjData = await filterSubjRes.json();
    const allMatchSubject = filterSubjData.data.every(n => (n.subject._id || n.subject) === testSubjectId);
    record('Filter Notes by Subject', filterSubjRes.status === 200 && filterSubjData.data.length >= 1 && allMatchSubject, `Found ${filterSubjData.count} notes for CS306`);

    // 11. Search notes by title
    const searchRes = await fetch(`${BASE_URL}/api/notes?search=Penetration`);
    const searchData = await searchRes.json();
    record('Search Notes by Title (search=Penetration)', searchRes.status === 200 && searchData.data.length >= 1, `Matches: ${searchData.count}`);

    // 12. GET single note by ID
    const getSingleNote = await fetch(`${BASE_URL}/api/notes/${testNoteId}`);
    const singleNoteData = await getSingleNote.json();
    record('Get Note by ID (GET /api/notes/:id)', getSingleNote.status === 200 && singleNoteData.data.title.includes('Penetration'));

    // 13. Preview & Download PDF endpoints via MongoDB GridFS
    const previewRes = await fetch(`${BASE_URL}/api/notes/${testNoteId}/file`);
    record('Preview Note PDF via GridFS Stream (GET /api/notes/:id/file)', previewRes.status === 200 && previewRes.headers.get('content-type')?.includes('pdf'));

    const downloadRes = await fetch(`${BASE_URL}/api/notes/${testNoteId}/download`);
    record('Download Note PDF via GridFS Stream (GET /api/notes/:id/download)', downloadRes.status === 200 && downloadRes.headers.get('content-type')?.includes('pdf'));

    // 14. PUT update note details
    const putNoteRes = await fetch(`${BASE_URL}/api/notes/${testNoteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Network Penetration Testing Lab Manual (Updated v2)',
        description: 'Updated with latest Wireshark capture filters.'
      })
    });
    const putNoteData = await putNoteRes.json();
    record('Update Note (PUT /api/notes/:id)', putNoteRes.status === 200 && putNoteData.data.title.includes('Updated v2'));

    // 15. DELETE note
    const delNoteRes = await fetch(`${BASE_URL}/api/notes/${testNoteId}`, {
      method: 'DELETE'
    });
    const delNoteData = await delNoteRes.json();
    record('Delete Note (DELETE /api/notes/:id)', delNoteRes.status === 200 && delNoteData.success === true);

    // Verify note is deleted
    const verifyNoteDel = await fetch(`${BASE_URL}/api/notes/${testNoteId}`);
    record('Verify Note Deleted (GET returns 404)', verifyNoteDel.status === 404);

    // 16. DELETE subject (now that note is deleted)
    const delSubjRes = await fetch(`${BASE_URL}/api/subjects/${testSubjectId}`, {
      method: 'DELETE'
    });
    const delSubjData = await delSubjRes.json();
    record('Delete Subject (DELETE /api/subjects/:id)', delSubjRes.status === 200 && delSubjData.success === true);

  } catch (err) {
    console.error('Unhandled error during test suite:', err);
    record('Test Suite Execution', false, err.message);
  } finally {
    // Clean up temporary files
    try {
      if (fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    } catch (e) {}

    console.log('\n=============================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

// Allow server 1 second to start and connect to DB, then run
setTimeout(runTests, 1500);

