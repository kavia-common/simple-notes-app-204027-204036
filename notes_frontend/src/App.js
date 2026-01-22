import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { createNote, deleteNote, listNotes, updateNote } from "./api/notes";

function clampSnippet(text, maxLen = 110) {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "No content";
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen).trim()}…`;
}

function validateNote({ title, content }) {
  const titleTrimmed = (title || "").trim();
  const contentTrimmed = (content || "").trim();

  if (!titleTrimmed) return "Please enter a title.";
  if (titleTrimmed.length > 120) return "Title is too long (max 120 characters).";
  if (contentTrimmed.length > 5000) return "Content is too long (max 5000 characters).";
  return null;
}

function emptyDraft() {
  return { title: "", content: "" };
}

/**
 * Notes App UI:
 * - Left: searchable notes list
 * - Right: editor for create/update
 * - Supports delete
 */
// PUBLIC_INTERFACE
function App() {
  /** Main Notes app component. */
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [search, setSearch] = useState("");

  const [draft, setDraft] = useState(emptyDraft());
  const [isDirty, setIsDirty] = useState(false);

  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const lastSelectedIdRef = useRef(null);

  const selectedNote = useMemo(
    () => notes.find((n) => String(n.id) === String(selectedId)) || null,
    [notes, selectedId]
  );

  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;

    return notes.filter((n) => {
      const hay = `${n.title}\n${n.content}`.toLowerCase();
      return hay.includes(q);
    });
  }, [notes, search]);

  const sortedNotes = useMemo(() => {
    // Keep simple deterministic sorting: newest-first if ids are numeric-ish; otherwise stable.
    const numeric = notes.every((n) => !Number.isNaN(Number(n.id)));
    if (!numeric) return filteredNotes;

    return [...filteredNotes].sort((a, b) => Number(b.id) - Number(a.id));
  }, [filteredNotes, notes]);

  async function refreshList({ preserveSelection = true } = {}) {
    setError("");
    setInfo("");
    setLoadingList(true);
    try {
      const data = await listNotes();
      setNotes(data);

      if (!preserveSelection) return;

      // If current selection disappeared, clear it.
      if (selectedId !== null && !data.some((n) => String(n.id) === String(selectedId))) {
        setSelectedId(null);
        setDraft(emptyDraft());
        setIsDirty(false);
      }
    } catch (e) {
      setError(e?.message || "Failed to load notes.");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    refreshList({ preserveSelection: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When selection changes (from clicking list), load draft from that note.
  useEffect(() => {
    const prev = lastSelectedIdRef.current;
    lastSelectedIdRef.current = selectedId;

    // If selection didn't change, skip.
    if (String(prev) === String(selectedId)) return;

    setError("");
    setInfo("");

    if (selectedNote) {
      setDraft({ title: selectedNote.title || "", content: selectedNote.content || "" });
      setIsDirty(false);
      return;
    }

    // Selected note cleared -> new note mode.
    setDraft(emptyDraft());
    setIsDirty(false);
  }, [selectedId, selectedNote]);

  function startNewNote() {
    setError("");
    setInfo("");
    setSelectedId(null);
    setDraft(emptyDraft());
    setIsDirty(false);
  }

  async function handleSave() {
    setError("");
    setInfo("");

    const validation = validateNote(draft);
    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    try {
      if (selectedId === null) {
        const created = await createNote({
          title: draft.title.trim(),
          content: draft.content.trim(),
        });
        setInfo("Note created.");
        // Refresh list and select created note if possible.
        await refreshList({ preserveSelection: false });
        if (created?.id !== undefined && created?.id !== null) setSelectedId(created.id);
        setIsDirty(false);
      } else {
        const updated = await updateNote(selectedId, {
          title: draft.title.trim(),
          content: draft.content.trim(),
        });
        setInfo("Note saved.");
        // Optimistic update to avoid flicker.
        setNotes((prev) =>
          prev.map((n) => (String(n.id) === String(selectedId) ? { ...n, ...updated } : n))
        );
        setIsDirty(false);
      }
    } catch (e) {
      setError(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setError("");
    setInfo("");

    if (selectedId === null) {
      setError("Select a note to delete.");
      return;
    }

    const ok = window.confirm("Delete this note? This cannot be undone.");
    if (!ok) return;

    setDeleting(true);
    try {
      await deleteNote(selectedId);
      setInfo("Note deleted.");
      setSelectedId(null);
      setDraft(emptyDraft());
      setIsDirty(false);
      await refreshList({ preserveSelection: false });
    } catch (e) {
      setError(e?.message || "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  const editorTitle = selectedId === null ? "New note" : "Edit note";
  const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || "";

  return (
    <div className="App">
      <div className="container">
        <div className="topbar">
          <div className="brand" aria-label="Simple Notes App">
            <div className="brand-badge" aria-hidden="true" />
            <div className="brand-title">
              <strong>Simple Notes</strong>
              <span>Light, fast, and focused</span>
            </div>
          </div>

          <div className="actions">
            <button className="btn" onClick={refreshList} disabled={loadingList || saving || deleting}>
              Refresh
            </button>
            <button className="btn btn-primary" onClick={startNewNote} disabled={saving || deleting}>
              + New
            </button>
          </div>
        </div>

        <div className="layout">
          <section className="card" aria-label="Notes list">
            <div className="card-header">
              <h2>
                Notes{" "}
                <span className="muted" style={{ fontWeight: 600 }}>
                  ({filteredNotes.length})
                </span>
              </h2>
            </div>

            <div className="card-body" style={{ paddingBottom: 0 }}>
              <label className="label" htmlFor="search">
                Search
              </label>
              <input
                id="search"
                className="search"
                placeholder="Search by title or content…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="list" role="listbox" aria-label="Notes">
              {loadingList ? (
                <>
                  <div className="note-item" aria-selected="false">
                    <p className="note-title">
                      <span className="skeleton" style={{ width: "55%", display: "inline-block" }} />
                    </p>
                    <p className="note-snippet">
                      <span className="skeleton" style={{ width: "92%", display: "inline-block" }} />
                    </p>
                  </div>
                  <div className="note-item" aria-selected="false">
                    <p className="note-title">
                      <span className="skeleton" style={{ width: "40%", display: "inline-block" }} />
                    </p>
                    <p className="note-snippet">
                      <span className="skeleton" style={{ width: "88%", display: "inline-block" }} />
                    </p>
                  </div>
                  <div className="note-item" aria-selected="false">
                    <p className="note-title">
                      <span className="skeleton" style={{ width: "62%", display: "inline-block" }} />
                    </p>
                    <p className="note-snippet">
                      <span className="skeleton" style={{ width: "86%", display: "inline-block" }} />
                    </p>
                  </div>
                </>
              ) : sortedNotes.length === 0 ? (
                <p className="muted" style={{ margin: 0, padding: "6px 6px 14px" }}>
                  {search.trim() ? "No notes match your search." : "No notes yet. Create your first note."}
                </p>
              ) : (
                sortedNotes.map((n) => {
                  const isSelected = selectedId !== null && String(n.id) === String(selectedId);
                  return (
                    <button
                      key={String(n.id)}
                      type="button"
                      className="note-item"
                      aria-selected={isSelected}
                      onClick={() => setSelectedId(n.id)}
                    >
                      <p className="note-title">{n.title || "Untitled"}</p>
                      <p className="note-snippet">{clampSnippet(n.content)}</p>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="card" aria-label="Note editor">
            <div className="card-header">
              <h2>{editorTitle}</h2>
            </div>

            <div className="card-body">
              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSave();
                }}
              >
                <div>
                  <label className="label" htmlFor="title">
                    Title
                  </label>
                  <input
                    id="title"
                    className="input"
                    value={draft.title}
                    placeholder="e.g., Grocery list"
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, title: e.target.value }));
                      setIsDirty(true);
                    }}
                    maxLength={120}
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="content">
                    Content
                  </label>
                  <textarea
                    id="content"
                    className="textarea"
                    value={draft.content}
                    placeholder="Write your note…"
                    onChange={(e) => {
                      setDraft((d) => ({ ...d, content: e.target.value }));
                      setIsDirty(true);
                    }}
                    maxLength={5000}
                  />
                </div>

                <div className="form-row">
                  <button className="btn btn-primary" type="submit" disabled={saving || deleting}>
                    {saving ? "Saving…" : selectedId === null ? "Create" : "Save"}
                  </button>

                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      if (selectedNote) {
                        setDraft({ title: selectedNote.title || "", content: selectedNote.content || "" });
                      } else {
                        setDraft(emptyDraft());
                      }
                      setIsDirty(false);
                      setError("");
                      setInfo("Changes discarded.");
                    }}
                    disabled={saving || deleting || !isDirty}
                  >
                    Discard
                  </button>

                  <button
                    className="btn btn-danger"
                    type="button"
                    onClick={handleDelete}
                    disabled={saving || deleting || selectedId === null}
                  >
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                </div>

                <div className="statusbar" aria-live="polite">
                  {info ? <span className="pill pill-info">{info}</span> : null}
                  {error ? <span className="pill pill-error">{error}</span> : null}
                  {!apiBaseUrl ? (
                    <span className="pill" title="Set REACT_APP_API_BASE_URL to your backend URL">
                      API base URL not set
                    </span>
                  ) : (
                    <span className="pill" title={apiBaseUrl}>
                      API: {apiBaseUrl.replace(/^https?:\/\//, "")}
                    </span>
                  )}
                </div>
              </form>
            </div>
          </section>
        </div>

        <p className="muted" style={{ marginTop: 14 }}>
          Tip: set <code>REACT_APP_API_BASE_URL</code> (e.g. <code>http://localhost:3001</code>) to connect to the backend.
        </p>
      </div>
    </div>
  );
}

export default App;
