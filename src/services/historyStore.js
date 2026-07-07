/**
 * Local, on-device session history using IndexedDB - no server, no account,
 * works offline. Every browser on every phone already has this built in.
 * Sessions are text-only (questions, answers, scores - no audio), so storage
 * footprint stays tiny even after heavy use (see size note in saveSession).
 */
const DB_NAME = 'speaking-partner-db';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported in this browser.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('mode', 'mode', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * A session is roughly: { id, mode, skill, scenario, date, messages, summaryResult }
 * As plain text, a full 10-15 question interview typically lands around 5-15KB -
 * even hundreds of saved sessions stay well under a few MB total.
 */
export async function saveSession(session) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(session);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllSessions() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      const sorted = request.result.sort((a, b) => new Date(b.date) - new Date(a.date));
      resolve(sorted);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateSessionFields(id, fields) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const existing = getRequest.result;
      if (!existing) {
        reject(new Error('Session not found'));
        return;
      }
      store.put({ ...existing, ...fields });
    };
    getRequest.onerror = () => reject(getRequest.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteSession(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Real, live number for "how much space is this actually using" - not a guess. */
export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      return await navigator.storage.estimate(); // { usage, quota } in bytes
    } catch {
      return null;
    }
  }
  return null;
}

/** Consecutive calendar days (up to today) with at least one saved session. */
export function computeStreak(sessions) {
  if (!sessions.length) return 0;
  const days = new Set(sessions.map((s) => new Date(s.date).toDateString()));
  let streak = 0;
  const cursor = new Date();
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
