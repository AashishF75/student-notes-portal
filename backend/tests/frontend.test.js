const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function testFrontend() {
  console.log('\n=============================================');
  console.log('   STARTING AUTOMATED BROWSER E2E TESTS      ');
  console.log('=============================================\n');

  const screenshotsDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const executablePath = fs.existsSync(chromePath) ? chromePath : undefined;

  console.log(`[Browser] Launching browser (Chrome path: ${executablePath || 'default bundled'})...`);
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  let passed = 0;
  let failed = 0;

  function record(name, isPass, detail = '') {
    if (isPass) {
      passed++;
      console.log(`[PASS] ${name} ${detail ? '(' + detail + ')' : ''}`);
    } else {
      failed++;
      console.error(`[FAIL] ${name} - ${detail}`);
    }
  }

  try {
    // 1. Load Homepage
    console.log('[Browser] Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 15000 });
    await page.screenshot({ path: path.join(screenshotsDir, '01-homepage.png') });

    const titleText = await page.$eval('.hero-title', el => el.innerText);
    record('Homepage Loaded & Hero Title Rendered', titleText.includes('Centralized Academic Notes'), titleText);

    const statsNumbers = await page.$$eval('.stat-number', els => els.map(e => e.innerText));
    record('Core Statistics Rendered', statsNumbers.length >= 3, `Stats: ${statsNumbers.join(', ')}`);

    // 2. Navigate to Subjects
    console.log('[Browser] Clicking "Explore Subjects"...');
    await page.click('.hero-cta-group .btn-primary');
    await page.waitForSelector('.subjects-grid', { timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotsDir, '02-subjects-list.png') });

    const subjectCardsCount = await page.$$eval('.subject-card', els => els.length);
    record('Curriculum Subjects Grid Rendered', subjectCardsCount >= 5, `Found ${subjectCardsCount} subjects`);

    // 3. Filter Notes by clicking Subject Card (Computer Networks)
    console.log('[Browser] Clicking "Computer Networks" subject card...');
    const firstSubject = await page.$('.subject-card');
    await firstSubject.click();
    await page.waitForSelector('.notes-page', { timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotsDir, '03-filtered-notes.png') });

    const filterChips = await page.$$eval('.filter-chip', els => els.map(e => e.innerText));
    record('Subject Filtering Active in Notes List', filterChips.length > 0, `Chips: ${filterChips.join(', ')}`);

    // 4. Reset Filter & Test Search
    console.log('[Browser] Testing Search for "Regression"...');
    await page.click('.controls-bar .btn-secondary'); // "Show All" reset button
    await sleep(500);

    const searchInput = await page.$('.search-input');
    await searchInput.type('Regression');
    await sleep(600); // Allow debounce / state update
    await page.screenshot({ path: path.join(screenshotsDir, '04-search-results.png') });

    const noteTitles = await page.$$eval('.note-title', els => els.map(e => e.innerText));
    const foundRegression = noteTitles.some(t => t.toLowerCase().includes('regression'));
    record('Search Notes by Title ("Regression")', foundRegression, `Found: ${noteTitles.join('; ')}`);

    // 5. Test Table View Toggle
    console.log('[Browser] Switching to Table View mode...');
    const tableToggleBtn = (await page.$$('.view-toggle-btn'))[1];
    await tableToggleBtn.click();
    await page.waitForSelector('.notes-data-table', { timeout: 3000 });
    await page.screenshot({ path: path.join(screenshotsDir, '05-table-view.png') });

    const tableRows = await page.$$eval('.notes-data-table tbody tr', els => els.length);
    record('HTML5 & CSS3 Table View Toggle', tableRows >= 1, `${tableRows} table row(s)`);

    // Switch back to grid view
    const gridToggleBtn = (await page.$$('.view-toggle-btn'))[0];
    await gridToggleBtn.click();
    await sleep(300);

    // 6. Test PDF Viewer Modal
    console.log('[Browser] Testing "View PDF" modal...');
    const viewPdfBtn = await page.$('.btn-view-pdf');
    await viewPdfBtn.click();
    await page.waitForSelector('.pdf-viewer-modal', { timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotsDir, '06-pdf-modal.png') });

    const modalTitle = await page.$eval('.pdf-viewer-modal h3', el => el.innerText);
    record('PDF Viewer Modal Preview', !!modalTitle, `Previewing: "${modalTitle}"`);

    // Close modal
    await page.click('.pdf-viewer-modal .modal-close-btn');
    await sleep(300);

    // 7. Role Switcher: Toggle to Faculty Mode
    console.log('[Browser] Switching user role to Faculty Mode...');
    await page.click('.role-toggle-btn');
    await sleep(300);

    const roleText = await page.$eval('.role-label', el => el.innerText);
    record('Role Switcher to Faculty Mode', roleText.includes('Faculty'), `Active: ${roleText}`);

    // 8. Navigate to Upload Note Form
    console.log('[Browser] Navigating to Upload Notes Form...');
    // Click upload nav link
    const uploadNavBtn = await page.$('button.nav-link-btn:nth-child(4)');
    await uploadNavBtn.click();
    await page.waitForSelector('.note-upload-form', { timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotsDir, '07-upload-form.png') });

    record('Upload Notes Form Rendered', true);

    // 9. Fill and Submit Upload Form
    console.log('[Browser] Filling out upload form...');
    await page.type('#noteTitle', 'Automata Theory & Formal Grammars Comprehensive Guide');
    await page.select('#noteSubject', await page.$eval('#noteSubject option:nth-child(2)', el => el.value));
    await page.type('#facultyName', 'Dr. Eleanor Vance');
    await page.type('#noteDescription', 'Complete lecture guide detailing deterministic and non-deterministic finite automata, regular expressions, pumping lemma, and context-free languages.');

    // Create a temporary valid PDF to upload
    const testPdfPath = path.join(__dirname, 'test-upload.pdf');
    fs.writeFileSync(testPdfPath, '%PDF-1.4\n%Test PDF for frontend upload\n%%EOF');

    const fileInput = await page.$('.hidden-file-input');
    await fileInput.uploadFile(testPdfPath);
    await sleep(500);

    await page.screenshot({ path: path.join(screenshotsDir, '08-upload-form-filled.png') });

    // Submit form
    console.log('[Browser] Submitting upload form...');
    await page.click('.btn-submit-upload');
    await page.waitForSelector('.upload-success-box', { timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotsDir, '09-upload-success.png') });

    const successBoxText = await page.$eval('.upload-success-box h4', el => el.innerText);
    record('PDF Note Upload & Publication Workflow', successBoxText.includes('Successfully'), successBoxText);

    // Clean up test file
    try { fs.unlinkSync(testPdfPath); } catch (e) {}

    // 10. Navigate to Notes List and verify newly uploaded note appears
    console.log('[Browser] Navigating back to Notes list to verify published note...');
    await page.click('.success-actions .btn-primary');
    await page.waitForSelector('.notes-page', { timeout: 5000 });

    // Clear any residual search from earlier test step to display all notes
    const clearBtn = await page.$('.search-clear-btn');
    if (clearBtn) {
      await clearBtn.click();
      await sleep(600);
    }

    await page.waitForSelector('.notes-grid', { timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotsDir, '10-notes-after-upload.png') });

    const allTitles = await page.$$eval('.note-title', els => els.map(e => e.innerText));
    const newNoteFound = allTitles.some(t => t.includes('Automata Theory'));
    record('Uploaded Note Persisted & Visible in Notes List', newNoteFound, `Found: "Automata Theory..." in ${allTitles.length} notes`);

  } catch (err) {
    console.error('[Browser Test Error]', err);
    record('Browser E2E Execution', false, err.message);
  } finally {
    await browser.close();
    console.log('\n=============================================');
    console.log(`BROWSER E2E SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('=============================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

testFrontend();

