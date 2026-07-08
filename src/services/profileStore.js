/**
 * Preparation Profile storage. Deliberately a SEPARATE IndexedDB database from
 * historyStore.js's session storage - this means adding profiles carries zero
 * risk to the existing, working sessions schema/version. Fully additive.
 */
const DB_NAME = 'speaking-partner-profiles-db';
const DB_VERSION = 1;
const STORE_NAME = 'profiles';
const ACTIVE_PROFILE_KEY = 'activeProfileId';

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
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Accepts "6m", "1y", "1y 6m", "2y", "3y 8m", "5y" - rejects anything else. */
export function isValidExperienceFormat(value) {
  return /^(\d+y( \d+m)?|\d+m)$/.test((value || '').trim());
}

export async function createProfile({ targetRole, experience, technologies = [] }) {
  if (!targetRole || !targetRole.trim()) {
    throw new Error('Target role is required.');
  }
  if (!isValidExperienceFormat(experience)) {
    throw new Error('Experience must look like "1y 7m", "2y", or "6m".');
  }

  const profile = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    targetRole: targetRole.trim(),
    experience: experience.trim(),
    technologies,
    targetCompany: null, // optional - set later via Interview Setup or Edit, never required here
    createdAt: new Date().toISOString(),
  };

  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(profile);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return profile;
}

export async function getAllProfiles() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getProfile(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/** targetRole is silently protected here - it can never be changed once created. */
export async function updateProfile(id, fields) {
  const { targetRole, ...safeFields } = fields;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);
    getRequest.onsuccess = () => {
      const existing = getRequest.result;
      if (!existing) {
        reject(new Error('Profile not found'));
        return;
      }
      store.put({ ...existing, ...safeFields });
    };
    getRequest.onerror = () => reject(getRequest.error);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteProfile(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function getActiveProfileId() {
  return localStorage.getItem(ACTIVE_PROFILE_KEY);
}

export function setActiveProfileId(id) {
  localStorage.setItem(ACTIVE_PROFILE_KEY, id);
}
