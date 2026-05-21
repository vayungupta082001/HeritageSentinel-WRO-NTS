/**
 * ============================================================
 * botService.js
 * ============================================================
 * ARCHITECTURE DECISION: Domain service for /bots collection.
 *
 * All bot-related Firestore logic lives here.
 * Pages/components call these functions; they never touch
 * Firestore directly.
 *
 * Bot schema (Firestore document structure):
 * {
 *   uid            : string   — e.g. "BOT_001"  (doc ID)
 *   name           : string   — display name
 *   status         : string   — see BOT_STATUSES below
 *   battery        : number   — 0-100 (%)
 *   assignedArtifact: string | null   — artifact uid
 *   currentTour    : string | null   — tour uid
 *   currentGuide   : string | null   — guide uid
 *   interactionID  : string | null   — interaction uid
 *   closestArtifact: string | null   — nearest artifact by AprilTag
 *   lastAprilTag   : string | null   — e.g. "TAG_012"
 *   position       : { x: number, y: number } | null
 *   mode           : string          — "autonomous" | "manual" | "standby"
 *   lastSeen       : Timestamp
 *   lastUpdated    : Timestamp  (managed by firebaseService)
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
  runBatch,
  serverTimestamp,
  db,
  where,
  doc,
} from './firebaseService';

// ─────────────────────────────────────────────────────────────
// ALLOWED STATUS VALUES
// Validated before any write to prevent bad data in Firestore.
// ─────────────────────────────────────────────────────────────
export const BOT_STATUSES = [
  'idle',
  'charging',
  'tour',
  'guide',
  'alert',
  'sentry',
  'maintenance',
  'offline',
];

function validateStatus(status) {
  if (!BOT_STATUSES.includes(status)) {
    throw new Error(`Invalid bot status: "${status}". Allowed: ${BOT_STATUSES.join(', ')}`);
  }
}

// ─────────────────────────────────────────────────────────────
// READS
// ─────────────────────────────────────────────────────────────

/** Fetch a single bot by its uid (doc ID). */
export async function getBot(uid) {
  return getDocument(COLLECTIONS.BOTS, uid);
}

/** Fetch all bots (one-shot). Use subscribeToBots for real-time. */
export async function getAllBots() {
  return getCollection(COLLECTIONS.BOTS);
}

// ─────────────────────────────────────────────────────────────
// REAL-TIME LISTENERS
// ─────────────────────────────────────────────────────────────

/**
 * Subscribe to ALL bots in real time.
 * Used by useBots hook and the admin dashboard.
 *
 * SCALABILITY: For fleets > 100 bots consider filtering by
 * zone or status to reduce bandwidth.
 *
 * @param onData  (bots: BotDoc[]) => void
 * @param onError (err: Error) => void
 * @returns unsubscribe function
 */
export function subscribeToBots(onData, onError) {
  return subscribeToCollection(COLLECTIONS.BOTS, onData, onError);
}

/**
 * Subscribe to a single bot by uid.
 * Used by individual bot detail panels.
 */
export function subscribeToBot(uid, onData, onError) {
  return subscribeToDocument(COLLECTIONS.BOTS, uid, onData, onError);
}

/**
 * Subscribe only to bots with a specific status.
 * Example: subscribeToBotsByStatus('alert', handleAlerts)
 */
export function subscribeToBotsByStatus(status, onData, onError) {
  validateStatus(status);
  return subscribeToCollection(
    COLLECTIONS.BOTS,
    onData,
    onError,
    [where('status', '==', status)]
  );
}

// ─────────────────────────────────────────────────────────────
// WRITES
// ─────────────────────────────────────────────────────────────

/**
 * Create or fully replace a bot document.
 * Used by the seeder and admin reset flows.
 */
export async function createBot(botData) {
  validateStatus(botData.status);
  await setDocument(COLLECTIONS.BOTS, botData.uid, {
    ...botData,
    lastSeen: serverTimestamp(),
  }, { merge: false });
}

/**
 * Update only the fields provided.
 * This is the primary "command" pathway for bot state changes.
 */
export async function updateBot(uid, fields) {
  if (fields.status) validateStatus(fields.status);
  await updateDocument(COLLECTIONS.BOTS, uid, {
    ...fields,
    lastSeen: serverTimestamp(),
  });
}

/**
 * Update bot status and optionally its mode atomically.
 * Convenience wrapper to avoid raw updateBot calls in UI code.
 */
export async function setBotStatus(uid, status, mode = null) {
  validateStatus(status);
  const fields = { status, lastSeen: serverTimestamp() };
  if (mode) fields.mode = mode;
  await updateDocument(COLLECTIONS.BOTS, uid, fields);
}

/**
 * Assign a bot to an artifact.
 * Also marks that artifact's assignedBot in the same batch
 * (via the artifactService pattern) to keep both docs in sync.
 *
 * ARCHITECTURE: Cross-collection atomic batch write.
 */
export async function assignBotToArtifact(botUid, artifactUid) {
  await runBatch(batch => {
    const botRef      = doc(db, COLLECTIONS.BOTS, botUid);
    const artifactRef = doc(db, COLLECTIONS.ARTIFACTS, artifactUid);
    batch.update(botRef,      { assignedArtifact: artifactUid, lastSeen: serverTimestamp() });
    batch.update(artifactRef, { assignedBot: botUid,           lastUpdated: serverTimestamp() });
  });
}

/**
 * Unassign a bot from its current artifact.
 */
export async function unassignBot(botUid, previousArtifactUid) {
  await runBatch(batch => {
    const botRef = doc(db, COLLECTIONS.BOTS, botUid);
    batch.update(botRef, {
      assignedArtifact: null,
      currentTour:      null,
      currentGuide:     null,
      status:           'idle',
      lastSeen:         serverTimestamp(),
    });
    if (previousArtifactUid) {
      const artifactRef = doc(db, COLLECTIONS.ARTIFACTS, previousArtifactUid);
      batch.update(artifactRef, { assignedBot: null, lastUpdated: serverTimestamp() });
    }
  });
}

/**
 * Update bot's AprilTag position (called by the localization subsystem).
 * Future-ready: when AprilTag readers come online, pipe their output here.
 *
 * @param uid       Bot uid
 * @param tagId     e.g. "TAG_012"
 * @param position  { x: number, y: number }
 */
export async function updateBotPosition(uid, tagId, position) {
  await updateDocument(COLLECTIONS.BOTS, uid, {
    lastAprilTag:    tagId,
    position,
    closestArtifact: null, // cleared until re-computed by localization
    lastSeen:        serverTimestamp(),
  });
}

/**
 * Delete a bot document (admin/decommission flow).
 */
export async function deleteBot(uid) {
  const { deleteDocument } = await import('./firebaseService');
  await deleteDocument(COLLECTIONS.BOTS, uid);
}
