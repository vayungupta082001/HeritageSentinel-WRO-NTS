/**
 * ============================================================
 * firebaseService.js
 * ============================================================
 * ARCHITECTURE DECISION: Central Firebase gateway.
 *
 * This is the ONLY file in the src/ tree that is allowed to
 * import from "firebase/firestore". Every page and component
 * goes through this layer (or the domain services built on top
 * of it: botService, artifactService, alertService).
 *
 * Why?
 *  - One place to swap SDK versions or backends (e.g. emulator)
 *  - One place to add auth headers, telemetry, or rate-limiting
 *  - Pages stay pure React — no Firestore logic leaking in
 *  - Easier unit testing: mock this file, not Firebase internals
 *
 * Rule: src/pages/** and src/components/** must NEVER import
 * anything from "firebase/firestore" directly.
 * ============================================================
 */

import { db } from '../firebaseConfig';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  increment,
} from 'firebase/firestore';


// ─────────────────────────────────────────────────────────────
// COLLECTION NAMES
// Centralised constants so a rename is a single-line change.
// ─────────────────────────────────────────────────────────────
export const COLLECTIONS = {
  BOTS:         'bots',
  ARTIFACTS:    'artifacts',
  INTERACTIONS: 'interactions',
  ALERTS:       'alerts',
  ADMIN:        'admin',
  SYSTEM:       'system',
  TOURS:        'tours',
  GUIDES:       'guides',
};

// ─────────────────────────────────────────────────────────────
// GENERIC CRUD HELPERS
// These are low-level primitives consumed by domain services.
// ─────────────────────────────────────────────────────────────

/**
 * Get a single document by ID.
 * Returns { id, ...data } or null if not found.
 */
export async function getDocument(collectionName, docId) {
  const ref = doc(db, collectionName, docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Get all documents in a collection.
 * Prefer real-time listeners (subscribeToCollection) in the UI.
 * Use this for one-shot admin reads or seed-checks.
 */
export async function getCollection(collectionName) {
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Write (create or overwrite) a document with a known ID.
 * Merges by default — pass merge:false to overwrite fully.
 */
export async function setDocument(collectionName, docId, data, { merge = true } = {}) {
  const ref = doc(db, collectionName, docId);
  await setDoc(ref, { ...data, lastUpdated: serverTimestamp() }, { merge });
}

/**
 * Partial update — only supplied fields are written.
 */
export async function updateDocument(collectionName, docId, data) {
  const ref = doc(db, collectionName, docId);
  await updateDoc(ref, { ...data, lastUpdated: serverTimestamp() });
}

/**
 * Hard delete a document.
 */
export async function deleteDocument(collectionName, docId) {
  await deleteDoc(doc(db, collectionName, docId));
}

/**
 * Firestore field increment helper (avoids read-modify-write race).
 * Usage: incrementField('alerts', 'ALERT_001', 'count', 1)
 */
export async function incrementField(collectionName, docId, fieldName, delta = 1) {
  const ref = doc(db, collectionName, docId);
  await updateDoc(ref, { [fieldName]: increment(delta), lastUpdated: serverTimestamp() });
}

/**
 * Atomic multi-document write via WriteBatch.
 * callback receives the batch and the db instance.
 * Example:
 *   await runBatch(batch => {
 *     batch.update(doc(db, 'bots', 'BOT_001'), { status: 'idle' });
 *     batch.update(doc(db, 'admin', 'summary'), { activeAlerts: increment(-1) });
 *   });
 */
export async function runBatch(callback) {
  const batch = writeBatch(db);
  callback(batch, db);
  await batch.commit();
}

// ─────────────────────────────────────────────────────────────
// REAL-TIME LISTENERS
// These return an `unsubscribe` function — call it in useEffect
// cleanup to avoid memory leaks.
// ─────────────────────────────────────────────────────────────

/**
 * Subscribe to a single document.
 * onData receives { id, ...fields } or null (deleted).
 */
export function subscribeToDocument(collectionName, docId, onData, onError) {
  const ref = doc(db, collectionName, docId);
  return onSnapshot(ref, snap => {
    onData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, onError);
}

/**
 * Subscribe to an entire collection.
 * Returns array of { id, ...fields } objects.
 *
 * SCALABILITY NOTE: For large collections always pass a `constraints`
 * array (Firestore query predicates) to limit the result set.
 * Full-collection listeners on 10 000-document collections will be
 * very slow and expensive.
 */
export function subscribeToCollection(collectionName, onData, onError, constraints = []) {
  const ref = collection(db, collectionName);
  const q   = constraints.length ? query(ref, ...constraints) : ref;
  return onSnapshot(q, snap => {
    onData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }, onError ?? console.error);
}

/**
 * Subscribe to collection filtered by a field value.
 * Convenience wrapper around subscribeToCollection.
 */
export function subscribeWhere(collectionName, field, op, value, onData, onError) {
  return subscribeToCollection(
    collectionName,
    onData,
    onError,
    [where(field, op, value)]
  );
}

// ─────────────────────────────────────────────────────────────
// RE-EXPORTS
// Domain services import these directly from here rather than
// from firebase/firestore, keeping the firestore SDK contained.
// ─────────────────────────────────────────────────────────────
export {
  db,
  serverTimestamp,
  where,
  orderBy,
  limit,
  collection,
  doc,
  increment,
};

/**
 * Runtime setter to change the artifacts collection name (dev feature).
 * Persists to localStorage so the choice survives page refreshes,
 * and dispatches a 'artifactsCollectionChanged' CustomEvent on window
 * so any mounted component can re-fetch without polling.
 *
 * Example: setArtifactsCollectionName('artifacts-my-museum')
 */
export function setArtifactsCollectionName(name) {
  if (typeof name === 'string' && name.trim().length) {
    COLLECTIONS.ARTIFACTS = name;
    try {
      localStorage.setItem('museumCollection', name);
    } catch (_) { /* localStorage unavailable (SSR / private mode) */ }
    window.dispatchEvent(
      new CustomEvent('artifactsCollectionChanged', { detail: { collection: name } })
    );
    console.log('Artifacts collection overridden to', name);
  }
}

/**
 * Reads the active artifacts collection name.
 * On first call it hydrates COLLECTIONS.ARTIFACTS from localStorage
 * so the value is correct even before Settings has been opened.
 */
export function getArtifactsCollectionName() {
  try {
    const stored = localStorage.getItem('museumCollection');
    if (stored && stored !== COLLECTIONS.ARTIFACTS) {
      COLLECTIONS.ARTIFACTS = stored;
    }
  } catch (_) { /* ignore */ }
  return COLLECTIONS.ARTIFACTS;
}