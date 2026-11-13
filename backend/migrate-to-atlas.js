const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const fs = require('fs');

const initialRequiredSubjects = [
  {
    name: 'Computer Networks',
    code: 'CS301',
    description: 'OSI and TCP/IP models, routing protocols, flow control, IP addressing, and socket programming.'
  },
  {
    name: 'Machine Learning',
    code: 'CS302',
    description: 'Supervised and unsupervised learning, regression, classification, neural networks, and model evaluation.'
  },
  {
    name: 'Full Stack Development',
    code: 'CS303',
    description: 'Modern frontend with React, backend architecture with Node/Express, REST APIs, and MongoDB.'
  },
  {
    name: 'Data Structures and Algorithms',
    code: 'CS304',
    description: 'Arrays, linked lists, trees, graphs, sorting, searching algorithms, and complexity analysis.'
  },
  {
    name: 'Database Management Systems',
    code: 'CS305',
    description: 'Relational algebra, SQL, normalization, transactions, concurrency control, and NoSQL databases.'
  }
];

async function migrateData() {
  console.log('\n================================================================');
  console.log('   MIGRATION: LOCAL MONGODB -> MONGODB ATLAS (cluster0)        ');
  console.log('================================================================\n');

  const atlasURI = process.env.MONGO_URI;
  if (!atlasURI) {
    throw new Error('MONGO_URI is missing in backend/.env!');
  }

  const maskedAtlasURI = atlasURI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  console.log(`[Config] Target Atlas URI: ${maskedAtlasURI}`);

  const localURI = 'mongodb://127.0.0.1:27017/studentNotes';
  console.log(`[Config] Source Local URI: ${localURI}`);

  // 1. Connect to both databases
  console.log('\n[Step 1] Connecting to databases...');
  const localConn = await mongoose.createConnection(localURI, { serverSelectionTimeoutMS: 5000 }).asPromise();
  console.log('[Source DB] Local MongoDB connected successfully.');

  const atlasConn = await mongoose.createConnection(atlasURI, { serverSelectionTimeoutMS: 15000 }).asPromise();
  console.log(`[Target DB] Atlas connected: ${atlasConn.host}/${atlasConn.name}`);

  // Subject and Note schemas
  const SubjectSchema = require('./models/Subject').schema;
  const NoteSchema = require('./models/Note').schema;

  const LocalSubject = localConn.model('Subject', SubjectSchema);
  const LocalNote = localConn.model('Note', NoteSchema);

  const AtlasSubject = atlasConn.model('Subject', SubjectSchema);
  const AtlasNote = atlasConn.model('Note', NoteSchema);

  // 2. Fetch local data
  console.log('\n[Step 2] Inspecting local database records...');
  const localSubjects = await LocalSubject.find().lean();
  const localNotes = await LocalNote.find().lean();
  console.log(`[Source DB] Found ${localSubjects.length} subjects and ${localNotes.length} notes in local MongoDB.`);

  // 3. Migrate Subjects to Atlas (no duplicates by code)
  console.log('\n[Step 3] Migrating / Verifying Subjects in Atlas...');
  const subjectIdMap = new Map(); // localId -> atlasId

  // First, migrate any existing local subjects
  for (const lSubj of localSubjects) {
    let atlasSubj = await AtlasSubject.findOne({ code: lSubj.code });
    if (!atlasSubj) {
      // Retain original _id if possible to preserve relations
      try {
        atlasSubj = await AtlasSubject.create({
          _id: lSubj._id,
          name: lSubj.name,
          code: lSubj.code,
          description: lSubj.description || '',
          createdAt: lSubj.createdAt || new Date()
        });
        console.log(` + Inserted Subject to Atlas: ${atlasSubj.name} (${atlasSubj.code}) [Preserved ID: ${atlasSubj._id}]`);
      } catch (err) {
        // If _id collides, create with new ID
        atlasSubj = await AtlasSubject.create({
          name: lSubj.name,
          code: lSubj.code,
          description: lSubj.description || '',
          createdAt: lSubj.createdAt || new Date()
        });
        console.log(` + Inserted Subject to Atlas: ${atlasSubj.name} (${atlasSubj.code}) [New ID: ${atlasSubj._id}]`);
      }
    } else {
      console.log(` = Subject already in Atlas: ${atlasSubj.name} (${atlasSubj.code}) [ID: ${atlasSubj._id}]`);
    }
    subjectIdMap.set(lSubj._id.toString(), atlasSubj._id);
  }

  // Ensure the 5 required syllabus subjects exist in Atlas
  console.log('\n[Step 4] Ensuring all 5 curriculum syllabus subjects exist in Atlas...');
  for (const reqSubj of initialRequiredSubjects) {
    let atlasSubj = await AtlasSubject.findOne({ code: reqSubj.code });
    if (!atlasSubj) {
      atlasSubj = await AtlasSubject.create(reqSubj);
      console.log(` + Seeded Missing Required Subject: ${atlasSubj.name} (${atlasSubj.code})`);
    } else {
      console.log(` ✓ Required Subject verified in Atlas: ${atlasSubj.name} (${atlasSubj.code})`);
    }
  }

  // 4. Migrate Notes to Atlas (no duplicates by title and localFileName)
  console.log('\n[Step 5] Migrating Notes to Atlas & Checking File Storage Paths...');
  const uploadsDir = path.join(__dirname, 'uploads');
  const fileAudit = [];

  let migratedNotesCount = 0;
  let skippedNotesCount = 0;

  for (const lNote of localNotes) {
    // Check file existence on disk
    let fileExists = false;
    let filePath = '';
    if (lNote.localFileName) {
      filePath = path.join(uploadsDir, lNote.localFileName);
      fileExists = fs.existsSync(filePath);
    } else if (lNote.fileUrl) {
      fileExists = true; // remote cloud URL
    }

    fileAudit.push({
      noteTitle: lNote.title,
      fileName: lNote.fileName,
      localFileName: lNote.localFileName,
      fileExists,
      filePath
    });

    // Check if already in Atlas
    const existingAtlasNote = await AtlasNote.findOne({
      title: lNote.title,
      fileName: lNote.fileName
    });

    if (!existingAtlasNote) {
      // Map subject reference
      const localSubjIdStr = lNote.subject ? lNote.subject.toString() : '';
      const mappedAtlasSubjId = subjectIdMap.get(localSubjIdStr) || lNote.subject;

      // Verify that the mapped subject actually exists in Atlas
      const validSubj = await AtlasSubject.findById(mappedAtlasSubjId);
      if (!validSubj) {
        console.warn(`[Warning] Note "${lNote.title}" references unknown subject ID ${mappedAtlasSubjId}. Skipping or reassigning.`);
        continue;
      }

      await AtlasNote.create({
        title: lNote.title,
        description: lNote.description,
        subject: validSubj._id,
        fileUrl: lNote.fileUrl,
        fileName: lNote.fileName,
        fileSize: lNote.fileSize || 0,
        cloudinaryPublicId: lNote.cloudinaryPublicId || null,
        localFileName: lNote.localFileName || null,
        uploadedBy: lNote.uploadedBy || 'Faculty',
        downloadsCount: lNote.downloadsCount || 0,
        createdAt: lNote.createdAt || new Date(),
        updatedAt: lNote.updatedAt || new Date()
      });

      console.log(` + Migrated Note: "${lNote.title}" -> Atlas [Subject: ${validSubj.code}, File Exists on Disk: ${fileExists}]`);
      migratedNotesCount++;
    } else {
      console.log(` = Note already exists in Atlas: "${lNote.title}" (Skipped)`);
      skippedNotesCount++;
    }
  }

  // 5. Final Atlas Verification
  console.log('\n[Step 6] Final Database Verification in Atlas...');
  const collections = await atlasConn.db.listCollections().toArray();
  const finalSubjectCount = await AtlasSubject.countDocuments();
  const finalNotesCount = await AtlasNote.countDocuments();

  console.log('\n================================================================');
  console.log('                    MIGRATION SUMMARY                           ');
  console.log('================================================================');
  console.log('Atlas Host:           ', atlasConn.host);
  console.log('Atlas Database:       ', atlasConn.name);
  console.log('Atlas Collections:    ', collections.map(c => c.name).join(', '));
  console.log('Atlas Subjects Count: ', finalSubjectCount);
  console.log('Atlas Notes Count:    ', finalNotesCount);
  console.log('Newly Migrated Notes: ', migratedNotesCount);
  console.log('Skipped (Duplicates): ', skippedNotesCount);
  console.log('Physical PDFs Checked:', fileAudit.length);
  const missingFiles = fileAudit.filter(f => !f.fileExists);
  console.log('Missing Local Files:  ', missingFiles.length);

  await localConn.close();
  await atlasConn.close();
  console.log('\n[Database] Connections closed cleanly.');

  return {
    atlasHost: atlasConn.host,
    databaseName: atlasConn.name,
    collections: collections.map(c => c.name),
    subjectCount: finalSubjectCount,
    notesCount: finalNotesCount,
    migratedNotesCount,
    skippedNotesCount,
    fileAudit
  };
}

migrateData().catch(err => {
  console.error('[Migration Error]', err);
  process.exit(1);
});

