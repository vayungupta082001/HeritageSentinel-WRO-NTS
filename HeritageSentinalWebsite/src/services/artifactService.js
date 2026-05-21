/**
 * ============================================================
 * artifactService.js
 * ============================================================
 * ARCHITECTURE DECISION: Domain service for /artifacts collection.
 *
 * Replaces the static public/artifacts.json file.
 * The Artifacts page used to do a one-time getDocs() directly
 * against Firestore — this service moves that logic here and
 * adds real-time listener support and write operations.
 *
 * Artifact schema (Firestore document structure):
 * {
 *   uid              : string   — e.g. "ART_001" (doc ID)
 *   name             : string
 *   category         : string   — "Weapons"|"Paintings"|"Pottery"|"Sculptures"
 *   era              : string   — e.g. "15th Century"
 *   image            : string   — URL
 *   description      : string
 *   context          : string   — extended historical context (for AI prompts)
 *   interactivePrompt: string   — seed question for MUSE AI
 *   status           : string   — "on_display"|"in_storage"|"on_loan"|"restoration"
 *   assignedBot      : string | null   — bot uid currently assigned
 *   nearestBot       : string | null   — closest bot by AprilTag
 *   nearestAprilTag  : string | null   — e.g. "TAG_005"
 *   alertCount       : number   — cumulative alerts for this artifact
 *   lastUpdated      : Timestamp
 * }
 * ============================================================
 */

import {
  COLLECTIONS,
  getDocument,
  getCollection,
  setDocument,
  updateDocument,
  subscribeToCollection,
  subscribeToDocument,
  serverTimestamp,
  where,
} from './firebaseService';

// ─────────────────────────────────────────────────────────────
// READS
// ─────────────────────────────────────────────────────────────

/** Fetch a single artifact by uid. */
export async function getArtifact(uid) {
  return getDocument(COLLECTIONS.ARTIFACTS, uid);
}

/**
 * Fetch all artifacts (one-shot).
 * ARCHITECTURE: replaces the old getDocs(collection(db, "artifacts"))
 * call that was directly inside Artifacts.jsx. Pages now call this
 * function instead.
 */
export async function getAllArtifacts() {
  return getCollection(COLLECTIONS.ARTIFACTS);
}

// ─────────────────────────────────────────────────────────────
// REAL-TIME LISTENERS
// ─────────────────────────────────────────────────────────────

/**
 * Subscribe to ALL artifacts in real time.
 * Replaces the one-shot useEffect fetch in Artifacts.jsx.
 *
 * SCALABILITY: If the collection grows beyond ~500 artifacts,
 * add an 'isActive' or 'status' filter here.
 *
 * @returns unsubscribe function
 */
export function subscribeToArtifacts(onData, onError) {
  return subscribeToCollection(COLLECTIONS.ARTIFACTS, onData, onError);
}

/** Subscribe to a single artifact by uid. */
export function subscribeToArtifact(uid, onData, onError) {
  return subscribeToDocument(COLLECTIONS.ARTIFACTS, uid, onData, onError);
}

/**
 * Subscribe to artifacts filtered by category.
 * Requires a Firestore composite index on (category, lastUpdated).
 */
export function subscribeByCategory(category, onData, onError) {
  return subscribeToCollection(
    COLLECTIONS.ARTIFACTS,
    onData,
    onError,
    [where('category', '==', category)]
  );
}

/**
 * Subscribe to artifacts that currently have an active alert.
 * (alertCount > 0 requires a Firestore index on alertCount)
 */
export function subscribeToAlertedArtifacts(onData, onError) {
  return subscribeToCollection(
    COLLECTIONS.ARTIFACTS,
    onData,
    onError,
    [where('alertCount', '>', 0)]
  );
}

// ─────────────────────────────────────────────────────────────
// WRITES
// ─────────────────────────────────────────────────────────────

/**
 * Create or fully replace an artifact document.
 * Used by the seeder and admin import flows.
 */
export async function createArtifact(artifactData) {
  await setDocument(COLLECTIONS.ARTIFACTS, artifactData.uid, {
    ...artifactData,
    alertCount:  artifactData.alertCount ?? 0,
    assignedBot: artifactData.assignedBot ?? null,
    nearestBot:  artifactData.nearestBot  ?? null,
  }, { merge: false });
}

/** Partial update for an artifact. */
export async function updateArtifact(uid, fields) {
  await updateDocument(COLLECTIONS.ARTIFACTS, uid, fields);
}

/**
 * Increment the alert counter for an artifact.
 * Called by alertService when a new alert is created.
 * Uses Firestore's atomic increment so concurrent writes are safe.
 */
export async function incrementArtifactAlerts(uid) {
  const { incrementField } = await import('./firebaseService');
  await incrementField(COLLECTIONS.ARTIFACTS, uid, 'alertCount');
}

/**
 * Update the nearest AprilTag for an artifact.
 * Called by the localization subsystem when a bot scans a tag
 * near this artifact's display area.
 *
 * Future-ready: integrate with AprilTag scanner events.
 */
export async function updateArtifactAprilTag(uid, tagId, nearestBotUid) {
  await updateDocument(COLLECTIONS.ARTIFACTS, uid, {
    nearestAprilTag: tagId,
    nearestBot:      nearestBotUid,
  });
}
