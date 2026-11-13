require('dotenv').config();
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Models for direct DB verification
const Subject = require('../models/Subject');
const Note = require('../models/Note');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Simple minimal valid PDF byte generator
function createTestPdf(title, subtitle) {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 200 >>
stream
BT
/F1 20 Tf
50 720 Td
(${title}) Tj
/F1 12 Tf
0 -35 Td
(${subtitle}) Tj
0 -25 Td
(College Notes Sharing Portal - Automated Test Document) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000495 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
566
%%EOF`;
  return Buffer.from(content, 'utf-8');
}

async function runDetailedE2E() {
  console.log('\n================================================================');
  console.log('   FULL END-TO-END VERIFICATION: PUPPETEER, UI & MONGODB DB   ');
  console.log('================================================================\n');

  // Connect directly to MongoDB for parallel database assertions
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    throw new Error('MONGO_URI is missing in backend/.env configuration');
  }
  const maskedURI = mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  console.log(`[Database] Connecting to MongoDB Atlas: ${maskedURI}`);
  await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 15000 });
  console.log('[Database] Mongoose directly connected to Atlas for verification assertions.');

  const screenshotsDir = path.join(__dirname, 'screenshots_e2e');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const executablePath = fs.existsSync(chromePath) ? chromePath : undefined;

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1366,850'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 850 });

  // Tracking containers
  const consoleMessages = [];
  const networkErrors = [];
  const apiCalls = [];
  const testResults = [];

  // Listen to browser console
  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    consoleMessages.push({ type, text });
    if (type === 'error') {
      console.error(`[Browser Console Error] ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    console.error(`[Browser Uncaught Page Error] ${err.message}`);
    networkErrors.push({ url: page.url(), error: err.message });
  });

  page.on('requestfailed', (req) => {
    console.error(`[Network Failed Request] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`);
    networkErrors.push({ url: req.url(), method: req.method(), error: req.failure()?.errorText });
  });

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/')) {
      const status = res.status();
      apiCalls.push({ method: res.request().method(), url, status });
    }
  });

  // Automatically accept confirmation dialogs (e.g. for note deletion)
  page.on('dialog', async (dialog) => {
    console.log(`[Browser Dialog] "${dialog.message()}" -> Accepting`);
    await dialog.accept();
  });

  function record(name, isPass, detail = '', apiData = null, dbData = null) {
    const item = { name, status: isPass ? 'PASS' : 'FAIL', detail, apiData, dbData };
    testResults.push(item);
    if (isPass) {
      console.log(`[PASS] ${name} ${detail ? '-> ' + detail : ''}`);
    } else {
      console.error(`[FAIL] ${name} -> ${detail}`);
    }
  }

  let createdNoteId = null;
  let createdGridFsFileId = null;
  let testUploadedFileName = null;

  try {
    // -------------------------------------------------------------
    // STEP 1: Open the Home Page
    // -------------------------------------------------------------
    console.log('\n--- Step 1: Open Home Page ---');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotsDir, '01_home_page.png') });

    const heroTitle = await page.$eval('.hero-title', (el) => el.innerText);
    const brandTitle = await page.$eval('.brand-title', (el) => el.innerText);
    record(
      'Open Home Page',
      heroTitle.includes('Centralized Academic Notes') && brandTitle === 'NotesHub',
      `Brand: "${brandTitle}", Hero Title: "${heroTitle}"`
    );

    // -------------------------------------------------------------
    // STEP 2: Fetch Subjects from MongoDB
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Fetch Subjects from MongoDB ---');
    // Verify subjects in database
    const dbSubjects = await Subject.find().sort({ code: 1 }).lean();
    console.log(`[DB Assertion] Found ${dbSubjects.length} subjects in MongoDB: ${dbSubjects.map(s => s.code).join(', ')}`);

    // Navigate to Subjects page
    await page.click('button.nav-link-btn:nth-child(2)'); // "Subjects" nav link
    await page.waitForSelector('.subjects-grid', { timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotsDir, '02_subjects_list.png') });

    const uiSubjectCards = await page.$$eval('.subject-card', (els) =>
      els.map((card) => ({
        code: card.querySelector('.code-pill')?.innerText,
        name: card.querySelector('.subject-name')?.innerText,
        notesCount: card.querySelector('.notes-badge')?.innerText
      }))
    );

    const allDbCodesRendered = dbSubjects.every((dbS) =>
      uiSubjectCards.some((uiS) => uiS.code === dbS.code)
    );

    record(
      'Fetch and Display Subjects from MongoDB',
      allDbCodesRendered && uiSubjectCards.length >= 5,
      `UI rendered ${uiSubjectCards.length} subjects matching MongoDB records.`,
      { subjectsCount: uiSubjectCards.length },
      { dbSubjectsCount: dbSubjects.length }
    );

    // -------------------------------------------------------------
    // STEP 3: Select a Subject
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Select a Subject ---');
    // Select Computer Networks (CS301)
    const cnCard = (await page.$$('.subject-card'))[0];
    const cnCode = await cnCard.$eval('.code-pill', el => el.innerText);
    await cnCard.click();

    await page.waitForSelector('.notes-page', { timeout: 5000 });
    await sleep(500);
    await page.screenshot({ path: path.join(screenshotsDir, '03_subject_filtered.png') });

    const filterChipText = await page.$eval('.filter-chip', el => el.innerText);
    const filteredCards = await page.$$('.note-card');

    record(
      'Select a Subject & Filter Notes',
      filterChipText.includes('Subject: CS301') && filteredCards.length >= 1,
      `Filtered by CS301. Active Filter Chip: "${filterChipText.trim()}", Displayed: ${filteredCards.length} note(s)`
    );

    // -------------------------------------------------------------
    // STEP 4: Search for Notes
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Search for Notes ---');
    // Clear subject filter to search across all notes
    await page.click('.controls-bar .btn-secondary'); // "Show All" button
    await sleep(400);

    const searchInput = await page.$('.search-input');
    await searchInput.type('Regression');
    await sleep(600);
    await page.screenshot({ path: path.join(screenshotsDir, '04_search_results.png') });

    const searchResults = await page.$$eval('.note-card', els =>
      els.map(el => ({
        title: el.querySelector('.note-title')?.innerText,
        subject: el.querySelector('.subject-tag-name')?.innerText
      }))
    );

    const hasRegression = searchResults.some(r => r.title.toLowerCase().includes('regression'));
    const isFiltered = searchResults.every(r => r.title.toLowerCase().includes('regression') || r.title.toLowerCase().includes('logistic'));

    record(
      'Search Notes by Title & Keywords',
      hasRegression && isFiltered,
      `Search query "Regression" returned ${searchResults.length} note: "${searchResults[0]?.title}"`
    );

    // Clear search
    await page.click('.search-clear-btn');
    await sleep(400);

    // -------------------------------------------------------------
    // STEP 5: Test Invalid File Uploads
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Test Invalid File Uploads ---');
    // Switch to Faculty mode
    await page.click('.role-toggle-btn');
    await sleep(300);

    // Go to Upload Note
    await page.click('button.nav-link-btn:nth-child(4)'); // "Upload Note"
    await page.waitForSelector('.note-upload-form', { timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotsDir, '05_upload_form_initial.png') });

    // Test A: Form validation for missing fields
    console.log('[Validation] Submitting empty form...');
    await page.click('.btn-submit-upload');
    await sleep(300);
    const isRequiredHandled = await page.$eval('#noteTitle', el => el.validity.valueMissing);
    record(
      'Form Validation - Missing Required Fields',
      isRequiredHandled === true,
      'HTML5 required validation prevented submission of empty form.'
    );

    // Test B: Invalid file type (.txt instead of .pdf)
    console.log('[Validation] Testing non-PDF file upload...');
    const tmpInvalidTxt = path.join(__dirname, 'sample-invalid.txt');
    fs.writeFileSync(tmpInvalidTxt, 'This is a plain text file, not a valid PDF.');

    const fileInputEl = await page.$('.hidden-file-input');
    await fileInputEl.uploadFile(tmpInvalidTxt);
    await sleep(400);
    await page.screenshot({ path: path.join(screenshotsDir, '06_invalid_file_rejected.png') });

    const invalidFormatAlert = await page.$eval('.error-alert', el => el.innerText).catch(() => '');
    record(
      'Reject Invalid Non-PDF File Format',
      invalidFormatAlert.includes('Invalid file format') && invalidFormatAlert.includes('PDF'),
      `Alert message: "${invalidFormatAlert.trim()}"`
    );
    try { fs.unlinkSync(tmpInvalidTxt); } catch (e) {}

    // Test C: Oversized file (>10MB)
    console.log('[Validation] Testing oversized file rejection (>10MB)...');
    const tmpOversizedPdf = path.join(__dirname, 'sample-oversized.pdf');
    // 10.5 MB buffer
    const bigBuf = Buffer.alloc(11 * 1024 * 1024, '%PDF-1.4\n%Oversized');
    fs.writeFileSync(tmpOversizedPdf, bigBuf);

    await fileInputEl.uploadFile(tmpOversizedPdf);
    await sleep(400);
    await page.screenshot({ path: path.join(screenshotsDir, '07_oversized_file_rejected.png') });

    const oversizedAlert = await page.$eval('.error-alert', el => el.innerText).catch(() => '');
    record(
      'Reject Oversized File (>10 MB)',
      oversizedAlert.includes('too large') && oversizedAlert.includes('10 MB'),
      `Alert message: "${oversizedAlert.trim()}"`
    );
    try { fs.unlinkSync(tmpOversizedPdf); } catch (e) {}

    // -------------------------------------------------------------
    // STEP 6: Upload a Valid PDF Note
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Upload a Valid PDF ---');
    // Clear previous error
    const alertClose = await page.$('.alert-close');
    if (alertClose) await alertClose.click();

    // Fill valid form fields
    const newNoteTitle = 'Deep Learning & Neural Network Architectures (E2E Verified)';
    const newNoteDesc = 'Comprehensive lecture notes on Convolutional Neural Networks, Backpropagation, and Transformer Attention mechanisms.';
    const newNoteFaculty = 'Dr. Alistair Ross';

    await page.type('#noteTitle', newNoteTitle);
    await page.select('#noteSubject', dbSubjects[1]._id.toString()); // Machine Learning CS302
    await page.type('#facultyName', newNoteFaculty);
    await page.type('#noteDescription', newNoteDesc);

    // Create valid PDF file
    const validTestPdfPath = path.join(__dirname, 'Deep-Learning-Notes-Lab.pdf');
    fs.writeFileSync(validTestPdfPath, createTestPdf(newNoteTitle, 'CS302 - Machine Learning'));

    await fileInputEl.uploadFile(validTestPdfPath);
    await sleep(500);
    await page.screenshot({ path: path.join(screenshotsDir, '08_upload_form_ready.png') });

    // Submit upload form
    console.log('[Upload] Submitting valid PDF note form...');
    await page.click('.btn-submit-upload');

    // Wait for success box
    await page.waitForSelector('.upload-success-box', { timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotsDir, '09_upload_success.png') });

    const successHeader = await page.$eval('.upload-success-box h4', el => el.innerText);
    record(
      'Upload Valid PDF Note',
      successHeader.includes('Published Successfully'),
      `Success box: "${successHeader}"`
    );

    try { fs.unlinkSync(validTestPdfPath); } catch (e) {}

    // -------------------------------------------------------------
    // STEP 7: Verify Note in UI & MongoDB
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Verify Note in UI & MongoDB ---');
    // 1. Verify in UI
    await page.click('.success-actions .btn-primary'); // "Go to Notes List"
    await page.waitForSelector('.notes-page', { timeout: 5000 });
    await sleep(600);
    await page.screenshot({ path: path.join(screenshotsDir, '10_notes_list_with_uploaded.png') });

    const uiNotes = await page.$$eval('.note-card', els =>
      els.map(el => ({
        title: el.querySelector('.note-title')?.innerText,
        subject: el.querySelector('.subject-tag-name')?.innerText,
        faculty: el.querySelector('.meta-text')?.innerText
      }))
    );

    const uiNoteFound = uiNotes.find(n => n.title === newNoteTitle);

    // 2. Verify in MongoDB directly
    const dbNote = await Note.findOne({ title: newNoteTitle }).populate('subject');
    const dbVerified = dbNote !== null && dbNote.uploadedBy === newNoteFaculty;
    if (dbNote) {
      createdNoteId = dbNote._id.toString();
      createdGridFsFileId = dbNote.gridFsFileId ? dbNote.gridFsFileId.toString() : null;
      testUploadedFileName = dbNote.localFileName;
    }

    record(
      'Verify Note in UI and MongoDB',
      !!uiNoteFound && dbVerified,
      `UI: Found "${uiNoteFound?.title}" by ${uiNoteFound?.faculty}. MongoDB: ID ${dbNote?._id}, Subject: ${dbNote?.subject?.code}`,
      { uiNoteFound },
      { dbNoteId: dbNote?._id, dbNoteFile: dbNote?.fileName, dbFileSize: dbNote?.fileSize }
    );

    // -------------------------------------------------------------
    // STEP 8: Open and Download the Uploaded PDF
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Open and Download the Uploaded PDF ---');
    // Find the card for our note
    const noteCards = await page.$$('.note-card');
    let targetCard = null;
    for (const card of noteCards) {
      const title = await card.$eval('.note-title', el => el.innerText);
      if (title === newNoteTitle) {
        targetCard = card;
        break;
      }
    }

    // A. Open PDF in Modal
    console.log('[PDF Viewer] Clicking View PDF...');
    const viewBtn = await targetCard.$('.btn-view-pdf');
    await viewBtn.click();
    await page.waitForSelector('.pdf-viewer-modal', { timeout: 5000 });
    await sleep(400);
    await page.screenshot({ path: path.join(screenshotsDir, '11_pdf_modal_opened.png') });

    const pdfModalTitle = await page.$eval('.pdf-viewer-modal h3', el => el.innerText);
    const pdfIframeSrc = await page.$eval('.pdf-iframe', el => el.src);

    record(
      'Open PDF in Interactive Viewer Modal',
      pdfModalTitle === newNoteTitle && (pdfIframeSrc.includes('/file') || pdfIframeSrc.includes('/api/notes/') || pdfIframeSrc.includes('/uploads/')),
      `Modal title: "${pdfModalTitle}", Iframe URL: "${pdfIframeSrc}"`
    );

    // Close modal
    await page.click('.pdf-viewer-modal .modal-close-btn');
    await sleep(300);

    // B. Download PDF via API
    console.log('[PDF Download] Testing download endpoint...');
    const downloadRes = await fetch(`http://localhost:5000/api/notes/${createdNoteId}/download`);
    const downloadContentType = downloadRes.headers.get('content-type');
    const downloadBytes = await downloadRes.arrayBuffer();

    // Verify download count increment in MongoDB
    const noteAfterDownload = await Note.findById(createdNoteId);

    record(
      'Download Uploaded PDF & Increment Downloads Counter',
      downloadRes.status === 200 && downloadBytes.byteLength > 0 && noteAfterDownload.downloadsCount >= 1,
      `HTTP ${downloadRes.status}, Content-Type: ${downloadContentType}, Bytes: ${downloadBytes.byteLength}, MongoDB downloadsCount: ${noteAfterDownload.downloadsCount}`
    );

    // -------------------------------------------------------------
    // STEP 9: Update Note Details
    // -------------------------------------------------------------
    console.log('\n--- Step 9: Update Note Details ---');
    const updatedTitle = 'Deep Learning & Neural Network Architectures (Revision 2026 Updated)';
    const updatedDesc = 'Updated syllabus including Transformers, Attention Mechanisms, and Self-Supervised Learning.';

    // Click edit button on the card
    const editBtn = await targetCard.$('.faculty-btn-edit');
    await editBtn.click();
    await page.waitForSelector('.modal-content', { timeout: 5000 });
    await sleep(300);

    // Clear and enter updated title and description using Control+A to select all text
    const titleInput = await page.$('.modal-form input.form-input');
    await titleInput.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await titleInput.type(updatedTitle);

    const descTextarea = await page.$('.modal-form textarea.form-textarea');
    await descTextarea.click();
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await descTextarea.type(updatedDesc);

    await page.screenshot({ path: path.join(screenshotsDir, '12_edit_modal_filled.png') });

    // Submit edit
    await page.click('.modal-actions .btn-primary');
    await sleep(800);
    await page.screenshot({ path: path.join(screenshotsDir, '13_after_note_update.png') });

    // Verify in MongoDB
    const dbNoteAfterUpdate = await Note.findById(createdNoteId);
    const dbTitleUpdated = dbNoteAfterUpdate.title === updatedTitle;

    record(
      'Update Note Details (Faculty Edit)',
      dbTitleUpdated && dbNoteAfterUpdate.description === updatedDesc,
      `MongoDB verified updated title: "${dbNoteAfterUpdate.title}"`
    );

    // -------------------------------------------------------------
    // STEP 10: Delete a Note & Clean Up Storage
    // -------------------------------------------------------------
    console.log('\n--- Step 10: Delete Note & Clean Up Storage ---');
    // Find target card again after re-render
    const refreshedCards = await page.$$('.note-card');
    let cardToDelete = null;
    for (const card of refreshedCards) {
      const title = await card.$eval('.note-title', el => el.innerText);
      if (title.includes('Deep Learning & Neural Network')) {
        cardToDelete = card;
        break;
      }
    }

    const deleteBtn = await cardToDelete.$('.faculty-btn-delete');
    await deleteBtn.click(); // dialog handler will accept
    await sleep(800);
    await page.screenshot({ path: path.join(screenshotsDir, '14_after_note_deleted.png') });

    // Verify deleted in MongoDB
    const dbNoteAfterDelete = await Note.findById(createdNoteId);

    // Verify file deleted from MongoDB GridFS
    const gridFsFileAfterDelete = createdGridFsFileId
      ? await mongoose.connection.db.collection('pdfs.files').findOne({ _id: new mongoose.Types.ObjectId(createdGridFsFileId) })
      : null;

    record(
      'Delete Note & Purge PDF from GridFS Storage',
      dbNoteAfterDelete === null && gridFsFileAfterDelete === null,
      `MongoDB record deleted: ${dbNoteAfterDelete === null}. GridFS file purged: ${gridFsFileAfterDelete === null}`
    );

  } catch (err) {
    console.error('[E2E Fatal Error]', err);
    record('E2E Execution', false, err.message);
  } finally {
    // 1. Output summary and write report FIRST before closing browser
    console.log('\n================================================================');
    console.log('                 E2E DETAILED TEST SUMMARY                      ');
    console.log('================================================================');
    const passedCount = testResults.filter(r => r.status === 'PASS').length;
    const failedCount = testResults.filter(r => r.status === 'FAIL').length;
    console.log(`TOTAL PASSED: ${passedCount} / ${testResults.length}`);
    console.log(`TOTAL FAILED: ${failedCount} / ${testResults.length}`);

    console.log('\n--- Console Messages Recorded ---');
    console.log(`Total console logs: ${consoleMessages.length}`);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    console.log(`Console errors: ${consoleErrors.length}`);

    console.log('\n--- Network Interceptions Recorded ---');
    console.log(`Total API calls: ${apiCalls.length}`);
    console.log(`Network request failures: ${networkErrors.length}`);

    // Output JSON report file for detailed inspection
    fs.writeFileSync(
      path.join(__dirname, 'e2e-report.json'),
      JSON.stringify({ testResults, apiCalls, consoleErrors, networkErrors }, null, 2)
    );
    console.log(`[Report] Saved e2e-report.json successfully.`);

    try {
      await mongoose.connection.close();
      console.log('[Database] Mongoose connection closed.');
    } catch (e) {}

    try {
      await browser.close().catch(() => {});
    } catch (e) {}

    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runDetailedE2E();
