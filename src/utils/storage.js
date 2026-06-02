// utils/storage.js
// Local Storage helper for the Bank Word Editor
// Schema per document:
// {
//   id: "<uuid-like-timestamp>",
//   originalFileName: "LoanAgreement.docx",
//   originalHtml: "<p>Converted original HTML</p>",
//   editedHtml: "<p>Edited HTML</p>",
//   lastUpdated: "2025-10-15T10:21:00.000Z",
//   version: 1
// }

const STORAGE_KEY = "bankEditorDocs_v1";

/**
 * readDocs - returns an array of saved docs (empty array if none)
 */
export function readDocs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("readDocs parse error:", err);
    return [];
  }
}

/**
 * writeDocs - writes the full array back to localStorage
 */
function writeDocs(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

/**
 * saveDocument - save a document into storage
 * @param {Object} doc - doc object (without id/version perhaps)
 * @param {boolean} replaceLast - if true, replace the last saved document
 * @returns {Object} saved doc (with id/version)
 */
export function saveDocument(doc, replaceLast = false) {
  const docs = readDocs();

  const now = new Date().toISOString();
  const id = doc.id || `${Date.now()}`; // simple ID by timestamp
  const existingIndex = docs.length - 1;

  // prepare doc copy
  const toSave = {
    ...doc,
    id,
    lastUpdated: now,
    version: (doc.version || 0) + 1,
  };

  if (replaceLast && docs.length > 0) {
    docs[existingIndex] = { ...docs[existingIndex], ...toSave };
  } else {
    docs.push(toSave);
  }

  writeDocs(docs);
  return toSave;
}

/**
 * getLastSaved - returns the last saved document or null
 */
export function getLastSaved() {
  const docs = readDocs();
  if (docs.length === 0) return null;
  return docs[docs.length - 1];
}

/**
 * clearAllDocs - remove all saved documents
 */
export function clearAllDocs() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * removeDocById - remove a single doc by id
 */
export function removeDocById(id) {
  const docs = readDocs().filter((d) => d.id !== id);
  writeDocs(docs);
}

/**
 * listDocs - returns array (copy) of docs
 */
export function listDocs() {
  return readDocs();
}
