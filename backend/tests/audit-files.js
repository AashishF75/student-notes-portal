const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('../models/Subject');
const Note = require('../models/Note');

async function auditDiscrepancy() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // 1. Local files on disk
  const uploadDir = path.join(__dirname, '..', 'uploads');
  const localFiles = fs.readdirSync(uploadDir).filter(f => f.endsWith('.pdf'));
  console.log(`\n================================================================`);
  console.log(`1. PHYSICAL FILES ON DISK IN backend/uploads/ (${localFiles.length} files)`);
  console.log(`================================================================`);
  localFiles.forEach(f => {
    const stat = fs.statSync(path.join(uploadDir, f));
    console.log(` - ${f} | ${stat.size} bytes | ${stat.mtime.toISOString()}`);
  });

  // 2. Atlas Notes
  const atlasNotes = await Note.find().populate('subject', 'code name').lean();
  console.log(`\n================================================================`);
  console.log(`2. ATLAS NOTE DOCUMENTS IN studentNotes.notes (${atlasNotes.length} notes)`);
  console.log(`================================================================`);
  atlasNotes.forEach(n => {
    console.log(` - ID: ${n._id}`);
    console.log(`   Title: "${n.title}" (${n.subject?.code})`);
    console.log(`   Original File: ${n.fileName}`);
    console.log(`   Local File: ${n.localFileName}`);
    console.log(`   GridFS ID: ${n.gridFsFileId}`);
    console.log(`   fileUrl: ${n.fileUrl}`);
  });

  // 3. GridFS pdfs.files
  const gridFsFiles = await mongoose.connection.db.collection('pdfs.files').find().toArray();
  console.log(`\n================================================================`);
  console.log(`3. GRIDFS FILES IN studentNotes.pdfs.files (${gridFsFiles.length} files)`);
  console.log(`================================================================`);
  gridFsFiles.forEach(gf => {
    console.log(` - GridFS ID: ${gf._id} | filename: ${gf.filename} | length: ${gf.length} | uploadDate: ${gf.uploadDate.toISOString()}`);
  });

  // 4. Match local files against Atlas Notes & GridFS
  console.log(`\n================================================================`);
  console.log(`4. DISCREPANCY ANALYSIS`);
  console.log(`================================================================`);
  localFiles.forEach(lf => {
    const matchedNote = atlasNotes.find(n => n.localFileName === lf);
    if (matchedNote) {
      console.log(` [REFERENCED] ${lf} -> Linked to Note: "${matchedNote.title}" (GridFS ID: ${matchedNote.gridFsFileId})`);
    } else {
      console.log(` [UNREFERENCED/ORPHAN] ${lf} -> Not referenced by any active note document in Atlas.`);
    }
  });

  await mongoose.disconnect();
}

auditDiscrepancy().catch(console.error);
