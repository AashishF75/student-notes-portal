require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Subject = require('./models/Subject');
const Note = require('./models/Note');
const { uploadBufferToGridFS } = require('./config/gridfs');

// Simple minimal valid PDF byte generator for sample notes
function createSamplePdfBuffer(title, subjectCode) {
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
/F1 24 Tf
50 720 Td
(${title}) Tj
/F1 14 Tf
0 -40 Td
(Subject Code: ${subjectCode}) Tj
0 -30 Td
(Department of Computer Science & Engineering) Tj
0 -30 Td
(Student Notes Sharing Portal - College Academic Repository) Tj
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

const initialSubjects = [
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

const seedDatabase = async () => {
  const mongoURI = process.env.MONGO_URI;
  if (!mongoURI) {
    throw new Error('MONGO_URI is missing in backend/.env configuration');
  }
  const maskedURI = mongoURI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  console.log(`[Seed] Connecting to MongoDB Atlas: ${maskedURI}`);

  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 15000
    });
    console.log('[Seed] Connected to MongoDB Atlas database successfully.');

    // 1. Seed Subjects without duplicates
    console.log('[Seed] Seeding subjects...');
    const createdSubjects = [];
    for (const subj of initialSubjects) {
      const existing = await Subject.findOne({ code: subj.code });
      if (!existing) {
        const created = await Subject.create(subj);
        createdSubjects.push(created);
        console.log(` + Inserted Subject: ${subj.name} (${subj.code})`);
      } else {
        createdSubjects.push(existing);
        console.log(` = Subject already exists: ${subj.name} (${subj.code})`);
      }
    }

    // 2. Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // 3. Seed Sample Notes if collection is empty
    const noteCount = await Note.countDocuments();
    if (noteCount === 0) {
      console.log('[Seed] Seeding initial sample lecture notes...');

      const sampleNotesData = [
        {
          title: 'TCP/IP Model and IP Subnetting Guide',
          description: 'Comprehensive lecture notes covering IPv4/IPv6 addressing, subnet masking calculations, CIDR notation, and network layer architecture.',
          subjectCode: 'CS301',
          facultyName: 'Dr. Robert Miller',
          samplePdfName: 'CS301-TCPIP-Subnetting-Guide.pdf'
        },
        {
          title: 'Linear & Logistic Regression Complete Notes',
          description: 'Detailed derivations of cost functions, gradient descent optimization, regularization (L1/L2), and confusion matrix metrics with examples.',
          subjectCode: 'CS302',
          facultyName: 'Prof. Ananya Sharma',
          samplePdfName: 'CS302-Regression-Analysis.pdf'
        },
        {
          title: 'MERN Stack Architecture & REST API Design',
          description: 'Production patterns for Express controllers, Mongoose schemas, JWT authorization, and React hooks state management.',
          subjectCode: 'CS303',
          facultyName: 'Prof. David Vance',
          samplePdfName: 'CS303-MERN-Architecture.pdf'
        },
        {
          title: 'Binary Search Trees & AVL Tree Rotations',
          description: 'In-depth notes on balanced binary search trees, AVL insertion/deletion, left/right rotation rules, and amortized time complexity.',
          subjectCode: 'CS304',
          facultyName: 'Dr. Sarah Jenkins',
          samplePdfName: 'CS304-BST-AVL-Trees.pdf'
        },
        {
          title: 'Relational Normalization: 1NF to BCNF',
          description: 'Step-by-step examples of finding candidate keys, decomposing tables, eliminating update anomalies, and preserving functional dependencies.',
          subjectCode: 'CS305',
          facultyName: 'Prof. Michael Chen',
          samplePdfName: 'CS305-Normalization-BCNF.pdf'
        }
      ];

      for (const item of sampleNotesData) {
        const targetSubject = createdSubjects.find((s) => s.code === item.subjectCode);
        if (targetSubject) {
          const pdfBuffer = createSamplePdfBuffer(item.title, item.subjectCode);
          const gridFsResult = await uploadBufferToGridFS(pdfBuffer, item.samplePdfName, {
            title: item.title,
            subjectCode: item.subjectCode,
            facultyName: item.facultyName
          });

          const note = new Note({
            title: item.title,
            description: item.description,
            subject: targetSubject._id,
            uploadedBy: item.facultyName,
            gridFsFileId: gridFsResult.gridFsFileId,
            fileUrl: '/api/notes/placeholder/file',
            fileName: item.samplePdfName,
            fileSize: pdfBuffer.length,
            downloadsCount: Math.floor(Math.random() * 25) + 5
          });

          note.fileUrl = `/api/notes/${note._id}/file`;
          await note.save();

          console.log(` + Inserted Note into GridFS: "${item.title}" for ${targetSubject.name} (GridFS ID: ${gridFsResult.gridFsFileId})`);
        }
      }
    } else {
      console.log(`[Seed] Notes collection already contains ${noteCount} record(s). Skipping sample notes.`);
    }

    console.log('[Seed] Database seeding completed successfully.');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]', error);
    process.exit(1);
  }
};

seedDatabase();

