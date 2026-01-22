import { apiClient } from "./client";

/**
 * @typedef {Object} Note
 * @property {string|number} id
 * @property {string} title
 * @property {string} content
 */

/**
 * Normalize unknown backend payload into a Note object shape we can rely on.
 * This makes the UI more resilient if the backend evolves.
 */
function normalizeNote(raw) {
  if (!raw || typeof raw !== "object") return null;

  const id = raw.id ?? raw.note_id ?? raw._id;
  const title = raw.title ?? "";
  const content = raw.content ?? raw.body ?? "";

  if (id === undefined || id === null) return null;

  return { id, title, content };
}

/**
 * Normalize list payload. Supports:
 * - array of notes
 * - { items: [...] }
 * - { notes: [...] }
 */
function normalizeNoteList(payload) {
  const list = Array.isArray(payload) ? payload : (payload?.items || payload?.notes || []);
  if (!Array.isArray(list)) return [];
  return list.map(normalizeNote).filter(Boolean);
}

// PUBLIC_INTERFACE
export async function listNotes() {
  /** List all notes. */
  const data = await apiClient.request("/notes");
  return normalizeNoteList(data);
}

// PUBLIC_INTERFACE
export async function createNote({ title, content }) {
  /** Create a new note. */
  const data = await apiClient.request("/notes", { method: "POST", body: { title, content } });
  return normalizeNote(data) || { id: data?.id, title, content };
}

// PUBLIC_INTERFACE
export async function updateNote(id, { title, content }) {
  /** Update an existing note. */
  const data = await apiClient.request(`/notes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: { title, content },
  });
  return normalizeNote(data) || { id, title, content };
}

// PUBLIC_INTERFACE
export async function deleteNote(id) {
  /** Delete a note by id. */
  await apiClient.request(`/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
  return true;
}
