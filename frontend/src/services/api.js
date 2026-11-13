/**
 * Student Notes Sharing Portal - API Service Layer
 * Abstracts REST API endpoints and handles error responses cleanly.
 */

// Production API URL configured via environment variable (e.g., Render backend on Vercel)
// In local dev, defaults to Vite proxy '/api' or localhost:5000/api
const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api`
  : '/api';

const SERVER_BASE = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace(/\/+$/, '')
  : '';

/**
 * Generic response handler
 */
async function handleResponse(response) {
  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data && data.error ? data.error : (data.message || `Request failed with status ${response.status}`);
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ----------------- SUBJECT APIS -----------------

export async function getSubjects() {
  const res = await fetch(`${API_BASE}/subjects`);
  const result = await handleResponse(res);
  return result.data || [];
}

export async function getSubjectById(id) {
  const res = await fetch(`${API_BASE}/subjects/${id}`);
  const result = await handleResponse(res);
  return result.data;
}

export async function createSubject(subjectData) {
  const res = await fetch(`${API_BASE}/subjects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subjectData)
  });
  return await handleResponse(res);
}

export async function updateSubject(id, subjectData) {
  const res = await fetch(`${API_BASE}/subjects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subjectData)
  });
  return await handleResponse(res);
}

export async function deleteSubject(id) {
  const res = await fetch(`${API_BASE}/subjects/${id}`, {
    method: 'DELETE'
  });
  return await handleResponse(res);
}

// ----------------- NOTES APIS -----------------

export async function getNotes({ subject, search, sort } = {}) {
  const params = new URLSearchParams();
  if (subject && subject !== 'all') params.append('subject', subject);
  if (search && search.trim()) params.append('search', search.trim());
  if (sort) params.append('sort', sort);

  const queryString = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/notes${queryString}`);
  const result = await handleResponse(res);
  return result.data || [];
}

export async function getNoteById(id) {
  const res = await fetch(`${API_BASE}/notes/${id}`);
  const result = await handleResponse(res);
  return result.data;
}

export async function uploadNote(formData) {
  const res = await fetch(`${API_BASE}/notes`, {
    method: 'POST',
    body: formData // Content-Type header set automatically by browser with multipart boundary
  });
  return await handleResponse(res);
}

export async function updateNote(id, formData) {
  const res = await fetch(`${API_BASE}/notes/${id}`, {
    method: 'PUT',
    body: formData
  });
  return await handleResponse(res);
}

export async function deleteNote(id) {
  const res = await fetch(`${API_BASE}/notes/${id}`, {
    method: 'DELETE'
  });
  return await handleResponse(res);
}

/**
 * Returns full download URL for direct trigger
 */
export function getDownloadUrl(noteId) {
  return `${API_BASE}/notes/${noteId}/download`;
}

/**
 * Formats file URL safely for viewing in browser
 */
export function resolveFileUrl(fileUrl) {
  if (!fileUrl) return '#';
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    // If backend provided a localhost URL and we are on remote, adjust if needed
    return fileUrl;
  }
  return `${SERVER_BASE}${fileUrl}`;
}

export { API_BASE, SERVER_BASE };

