async function verifyAll7Streams() {
  const notesRes = await fetch('http://localhost:5000/api/notes');
  const { data: notes } = await notesRes.json();
  console.log(`\n================================================================`);
  console.log(` STREAM VERIFICATION FOR ALL ${notes.length} ATLAS NOTES VIA GRIDFS`);
  console.log(`================================================================\n`);

  let allPassed = true;
  for (const [idx, note] of notes.entries()) {
    // 1. Preview stream
    const previewRes = await fetch(`http://localhost:5000/api/notes/${note._id}/file`);
    const previewBytes = await previewRes.arrayBuffer();
    const previewPassed = previewRes.status === 200 &&
      previewRes.headers.get('content-type')?.includes('pdf') &&
      previewBytes.byteLength === note.fileSize;

    // 2. Download stream
    const downloadRes = await fetch(`http://localhost:5000/api/notes/${note._id}/download`);
    const downloadBytes = await downloadRes.arrayBuffer();
    const downloadPassed = downloadRes.status === 200 &&
      downloadRes.headers.get('content-type')?.includes('pdf') &&
      downloadBytes.byteLength === note.fileSize;

    const notePassed = previewPassed && downloadPassed;
    if (!notePassed) allPassed = false;

    console.log(`${idx + 1}. [${notePassed ? 'PASS' : 'FAIL'}] "${note.title}" (${note.subject?.code || 'N/A'})`);
    console.log(`   - Document ID:     ${note._id}`);
    console.log(`   - GridFS File ID:  ${note.gridFsFileId}`);
    console.log(`   - File Name:       ${note.fileName}`);
    console.log(`   - Preview Stream:  HTTP ${previewRes.status} | ${previewBytes.byteLength} bytes | ${previewRes.headers.get('content-disposition')}`);
    console.log(`   - Download Stream: HTTP ${downloadRes.status} | ${downloadBytes.byteLength} bytes | ${downloadRes.headers.get('content-disposition')}\n`);
  }

  console.log(`================================================================`);
  console.log(`FINAL STREAM AUDIT RESULT: ${allPassed ? 'ALL 7 NOTES STREAMED SUCCESSFULLY (100% PASS)' : 'FAILURES DETECTED'}`);
  console.log(`================================================================\n`);

  if (!allPassed) process.exit(1);
}

verifyAll7Streams().catch(err => {
  console.error('[Stream Error]', err);
  process.exit(1);
});
