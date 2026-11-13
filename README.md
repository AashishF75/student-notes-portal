# Student Notes Sharing Portal

> A full-stack academic web portal engineered for colleges to facilitate syllabus-aligned lecture note distribution, PDF previews, and instant downloads. Features role-based views for students and faculty, persistent cloud storage support, and MongoDB Atlas database integration.

---

## 1. System Architecture & Tech Stack

### Frontend
- **Framework / Runtime:** React 18, Vite 6
- **Styling:** CSS3 (Custom Variables, Flexbox, CSS Grid, Media Queries, Blue & White Academic Theme)
- **Icons:** Lucide React
- **Services:** Modular REST API client (`src/services/api.js`)

### Backend
- **Runtime:** Node.js (v18+)
- **Framework:** Express.js 4
- **Database ODM:** Mongoose 8 (MongoDB Atlas)
- **Binary File Storage:** MongoDB GridFS (`pdfs.files`, `pdfs.chunks`) storing all PDF binary documents directly in MongoDB Atlas
- **Upload Engine:** Multer memory storage (strictly enforced 10 MB limit and PDF MIME/extension filter)
- **Security & Reliability:** CORS, centralized error handling, stream error handling, automatic GridFS orphan chunk cleanup.

---

## 2. Directory Structure

```
studentsPortal/
├── backend/
│   ├── config/
│   │   └── db.js                 # Mongoose connection & credential masking
│   ├── models/
│   │   ├── Subject.js            # Subject Schema (name, code, description)
│   │   └── Note.js               # Note Schema (title, description, fileUrl, etc.)
│   ├── routes/
│   │   ├── subjectRoutes.js      # Subject CRUD REST endpoints
│   │   └── noteRoutes.js         # Note CRUD, search, filter & download endpoints
│   ├── middleware/
│   │   ├── upload.js             # Multer PDF filter, 10MB limit, Cloudinary & local storage
│   │   └── errorHandler.js       # Centralized error handler & temp file cleanup
│   ├── tests/
│   │   └── api.test.js           # Automated end-to-end backend test suite
│   ├── uploads/                  # Local storage for uploaded PDF files
│   ├── server.js                 # Express server configuration
│   ├── seed.js                   # Subject & sample notes database seeder
│   ├── package.json
│   ├── render.yaml               # Render cloud deployment blueprint
│   ├── .env.example
│   └── .env
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx        # Responsive navigation with role switcher
│   │   │   ├── Home.jsx          # Hero section, statistics & search box
│   │   │   ├── SubjectList.jsx   # Subject cards & Faculty subject creation modal
│   │   │   ├── NotesList.jsx     # Notes grid/table, search, subject filter, PDF modal
│   │   │   ├── NoteCard.jsx      # Note card with view, download, edit, delete actions
│   │   │   ├── UploadNote.jsx    # Faculty drag & drop PDF upload form with validation
│   │   │   └── Footer.jsx        # Academic footer with curriculum topics & badges
│   │   ├── services/
│   │   │   └── api.js            # REST API client services
│   │   ├── App.jsx               # Application controller & state coordinator
│   │   ├── main.jsx              # React DOM entry point
│   │   └── style.css             # Blue & white responsive stylesheet
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js            # Vite configuration with proxy
│   └── vercel.json               # Vercel SPA routing configuration
│
├── package.json                  # Root orchestrator scripts
├── .gitignore
└── README.md
```

---

## 3. Core Features

### Student Experience
- **Subject-Wise Exploration:** Browse all core semester subjects (CS301 to CS305) with dynamic note count badges.
- **Title & Keyword Search:** Real-time search across note titles, descriptions, and instructor names.
- **Subject Filtering:** Instant dropdown filtering to narrow down materials by course code.
- **Dual View Modes:** Toggle between modern Card Grid and HTML5 Data Table views.
- **Interactive PDF Viewer:** Preview documents inline within a modal or open in a dedicated browser tab.
- **One-Click Download:** Fast direct download stream with automatic download counter tracking.

### Faculty Management
- **Role-Based View Switcher:** Honest, transparent role toggle in the navbar to switch between Student View and Faculty Mode.
- **Drag-and-Drop PDF Upload:** Upload notes with client and server-side validation (strict `.pdf` type and 10 MB maximum file size).
- **Curriculum Registration:** Add new course subjects directly from the portal.
- **Note Lifecycle Management:** Update note titles, descriptions, course codes, or replace PDF documents.
- **Safe Note Deletion:** Deletes database records and purges stored files from disk or Cloudinary to eliminate orphaned assets.

---

## 4. Getting Started Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [MongoDB](https://www.mongodb.com/) running locally on port 27017, OR a [MongoDB Atlas](https://www.mongodb.com/atlas) connection string.

### Step 1: Install Dependencies
From the project root:
```bash
npm run install:all
```
*(Or install individually: `cd backend && npm install`, then `cd ../frontend && npm install`)*

### Step 2: Configure Environment Variables
Inside `backend/.env`:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/studentNotes
CLIENT_URL=http://localhost:5173

# Optional: Persistent Cloud Storage (Cloudinary)
# CLOUDINARY_CLOUD_NAME=
# CLOUDINARY_API_KEY=
# CLOUDINARY_API_SECRET=
```

### Step 3: Seed Database
Populate the 5 core subjects and sample PDF lecture notes:
```bash
npm run seed
```
Initial subjects inserted:
1. `CS301` — Computer Networks
2. `CS302` — Machine Learning
3. `CS303` — Full Stack Development
4. `CS304` — Data Structures and Algorithms
5. `CS305` — Database Management Systems

### Step 4: Run the Backend
```bash
npm run dev:backend
```
Backend API will start at: `http://localhost:5000`

### Step 5: Run the Frontend
In another terminal:
```bash
npm run dev:frontend
```
Frontend will start at: `http://localhost:5173`

---

## 5. Automated Testing

The backend includes a comprehensive automated test suite verifying every CRUD operation, file upload rule, and security constraint.

Run the test suite:
```bash
npm run test:backend
```

### Verified Test Cases:
| Test Scenario | Endpoint / Action | Expected Result |
| :--- | :--- | :--- |
| **Health Check** | `GET /api/health` | HTTP 200 `status: online` |
| **List Subjects** | `GET /api/subjects` | HTTP 200 Array with note counts |
| **Create Subject** | `POST /api/subjects` | HTTP 201 Created subject object |
| **Get Subject By ID** | `GET /api/subjects/:id` | HTTP 200 Subject details |
| **Update Subject** | `PUT /api/subjects/:id` | HTTP 200 Updated subject |
| **Upload Valid PDF** | `POST /api/notes` | HTTP 201 Note created with file metadata |
| **Reject Non-PDF** | `POST /api/notes` (.txt file) | HTTP 400 Invalid file type rejection |
| **Reject > 10MB** | `POST /api/notes` (11MB file) | HTTP 400 File too large rejection |
| **List Notes** | `GET /api/notes` | HTTP 200 Array of populated notes |
| **Filter by Subject** | `GET /api/notes?subject=<id>` | HTTP 200 Filtered notes list |
| **Search by Title** | `GET /api/notes?search=<term>` | HTTP 200 Search result matches |
| **Download PDF** | `GET /api/notes/:id/download` | HTTP 200 / 302 Download stream |
| **Update Note** | `PUT /api/notes/:id` | HTTP 200 Updated note record |
| **Delete Note** | `DELETE /api/notes/:id` | HTTP 200 Purged from DB & storage |
| **Delete Subject** | `DELETE /api/subjects/:id` | HTTP 200 Deleted successfully |

---

## 6. REST API Reference

### Subjects Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/subjects` | Fetch all subjects with note counts |
| `GET` | `/api/subjects/:id` | Get single subject by ID |
| `POST` | `/api/subjects` | Register a new subject (`{ name, code, description }`) |
| `PUT` | `/api/subjects/:id` | Update subject details |
| `DELETE`| `/api/subjects/:id` | Delete subject (blocked if notes are attached) |

### Notes Endpoints
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/notes` | Fetch notes (query params: `subject`, `search`, `sort`) |
| `GET` | `/api/notes/:id` | Get single note with populated subject |
| `POST` | `/api/notes` | Upload note with PDF to GridFS (`multipart/form-data`, max 10MB) |
| `PUT` | `/api/notes/:id` | Update note and optionally replace PDF in GridFS |
| `DELETE`| `/api/notes/:id` | Delete note record and purge PDF from GridFS |
| `GET` | `/api/notes/:id/file` | Stream PDF inline from GridFS for browser preview |
| `GET` | `/api/notes/:id/download` | Stream PDF attachment from GridFS & increment download counter |

---

## 7. Production Deployment Guide

### A. MongoDB Atlas
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Under **Database Access**, create a user with read/write privileges.
3. Under **Network Access**, add IP `0.0.0.0/0` (allow from anywhere) for Render connectivity.
4. Copy your connection string:
   `mongodb+srv://<username>:<password>@cluster0.gnxspvv.mongodb.net/studentNotes?retryWrites=true&w=majority`

### B. Backend Deployment on Render
1. Create a new **Web Service** on [Render](https://render.com) pointing to your repository.
2. Configure settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
3. Add Environment Variables:
   - `MONGO_URI`: *Your MongoDB Atlas connection string*
   - `CLIENT_URL`: *Your Vercel frontend URL*
   - `NODE_ENV`: `production`
*(No external file-storage service needed: PDF documents persist permanently in MongoDB Atlas GridFS across Render restarts).*

### C. Frontend Deployment on Vercel
1. Import repository into [Vercel](https://vercel.com).
2. Configure settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Add Environment Variable:
   - `VITE_API_URL`: *Your deployed Render backend URL (e.g. `https://student-notes-backend.onrender.com`)*

