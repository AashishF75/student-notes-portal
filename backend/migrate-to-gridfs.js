const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const fs = require('fs');

const {
  getGridFSBucket,
  uploadBufferToGridFS,
  getGridFSFileInfo,
  getGridFSDownloadStream
} = require('./config/gridfs');

const Subject = require('./models/Subject');
const Note = require('./models/Note');

async function migrateLocalPdfsToGridFS() {
  console.log('\n================================================================');
  console.log('   MIGRATING LOCAL PDF ASSETS INTO MONGODB ATLAS GridFS        ');
  console.log('================================================================\n');

  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    throw new Error('MONGO_URI is missing in backend/.env');
  }

  const maskedURI = mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  console.log(`[Database] Connecting to Atlas: ${maskedURI}`);

  await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 15000 });
  console.log(`[Database] Connected: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const bucket = getGridFSBucket();
  const uploadsDir = path.join(__dirname, 'uploads');

  // Fetch all notes from Atlas
  const notes = await Note.find().populate('subject');
  console.log(`[Atlas] Found ${notes.length} note document(s) in Atlas.\n`);

  let migratedCount = 0;
  let alreadyInGridFSCount = 0;
  let missingLocalFiles = 0;
  const auditReport = [];

  for (const note of notes) {
    console.log(`----------------------------------------------------------------`);
    console.log(`Checking Note: "${note.title}" (${note.subject?.code || 'N/A'})`);
    console.log(` - Document ID: ${note._id}`);
    console.log(` - Stored File: ${note.fileName} | Local: ${note.localFileName || 'None'}`);

    // Check if already in GridFS
    let existsInGridFS = false;
    if (note.gridFsFileId) {
      const fileDoc = await getGridFSFileInfo(note.gridFsFileId);
      if (fileDoc) {
        existsInGridFS = true;
        console.log(` ✓ Already stored in GridFS: ID ${note.gridFsFileId} (${fileDoc.length} bytes)`);
        alreadyInGridFSCount++;
      }
    }

    if (!existsInGridFS) {
      // Find matching local file on disk
      let localPath = null;
      if (note.localFileName) {
        const candidate = path.join(uploadsDir, note.localFileName);
        if (fs.existsSync(candidate)) {
          localPath = candidate;
        }
      }

      // If not found by localFileName, try finding by original fileName
      if (!localPath && note.fileName) {
        const filesOnDisk = fs.readdirSync(uploadsDir);
        const match = filesOnDisk.find(f => f.includes(note.fileName));
        if (match) {
          localPath = path.join(uploadsDir, match);
        }
      }

      if (localPath && fs.existsSync(localPath)) {
        const fileBuffer = fs.readFileSync(localPath);
        console.log(` -> Reading local file: ${path.basename(localPath)} (${fileBuffer.length} bytes)`);

        // Upload to GridFS
        const uploadResult = await uploadBufferToGridFS(fileBuffer, note.fileName, {
          noteId: note._id,
          title: note.title,
          subjectCode: note.subject?.code,
          uploadedBy: note.uploadedBy
        });

        // Update note in Atlas
        note.gridFsFileId = uploadResult.gridFsFileId;
        note.fileUrl = `/api/notes/${note._id}/file`;
        note.fileSize = fileBuffer.length;
        await note.save();

        console.log(` + Successfully migrated to GridFS! GridFS ID: ${uploadResult.gridFsFileId}`);
        migratedCount++;
        existsInGridFS = true;
      } else {
        console.warn(` ! Local file not found on disk for note: ${note.title} (local: ${note.localFileName})`);
        missingLocalFiles++;
      }
    }

    // Verify stream retrieval from GridFS
    let streamVerified = false;
    let bytesRead = 0;
    if (note.gridFsFileId) {
      try {
        const readStream = getGridFSDownloadStream(note.gridFsFileId);
        const chunks = [];
        for await (const chunk of readStream) {
          chunks.push(chunk);
          bytesRead += chunk.length;
        }
        streamVerified = bytesRead > 0;
      } catch (streamErr) {
        console.error(` [Stream Error] Failed to read GridFS stream for note ${note._id}:`, streamErr.message);
      }
    }

    auditReport.push({
      id: note._id,
      title: note.title,
      subjectCode: note.subject?.code,
      gridFsFileId: note.gridFsFileId,
      fileSize: note.fileSize,
      streamVerified,
      bytesRead,
      previewUrl: `/api/notes/${note._id}/file`,
      downloadUrl: `/api/notes/${note._id}/download`
    });
  }

  // Check GridFS collection files count
  const gridFsFilesCount = await mongoose.connection.db.collection('pdfs.files').countDocuments();
  const gridFsChunksCount = await mongoose.connection.db.collection('pdfs.chunks').countDocuments();

  console.log('\n================================================================');
  console.log('                  GridFS MIGRATION AUDIT                        ');
  console.log('================================================================');
  console.log(`Total Atlas Notes Processed: ${notes.length}`);
  console.log(`Newly Migrated to GridFS:   ${migratedCount}`);
  console.log(`Already in GridFS:          ${alreadyInGridFSCount}`);
  console.log(`Missing Local Files:        ${missingLocalFiles}`);
  console.log(`GridFS Total Files (pdfs.files):  ${gridFsFilesCount}`);
  console.log(`GridFS Total Chunks (pdfs.chunks): ${gridFsChunksCount}`);
  console.log(`Stream Verification (Readable):   ${auditReport.filter(a => a.streamVerified).length} / ${notes.length}`);

  console.log('\nDetailed Notes Status:');
  auditReport.forEach((item, idx) => {
    console.log(` ${idx + 1}. [${item.streamVerified ? 'PASS' : 'FAIL'}] "${item.title}" (${item.subjectCode})`);
    console.log(`    GridFS ID: ${item.gridFsFileId} | Bytes: ${item.bytesRead} | Stream: Verified`);
  });

  await mongoose.disconnect();
  console.log('\n[Database] Mongoose disconnected.');
  return auditReport;
}

migrateLocalPdfsToGridFS().catch((err) => {
  console.error('[Migration Error]', err);
  process.exit(1);
});

