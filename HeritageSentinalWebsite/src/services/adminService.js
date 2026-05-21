/**
 * ============================================================
 * adminService.js
 * ============================================================
 * ARCHITECTURE DECISION: Admin aggregation service.
 *
 * Manages the /admin collection which holds pre-aggregated
 * counters and system-level metadata.
 *
 * WHY pre-aggregation?
 *   Counting bots/artifacts/alerts with getDocs().size on every
 *   page load is expensive. Instead we maintain a summary doc
 *   (admin/summary) that is updated atomically each time the
 *   underlying collections change.
 *
 * admin/summary schema:
 * {
 *   totalBots      : number
 *   totalArtifacts : number
 *   activeAlerts   : number   — drives the homepage health badge
 *   systemHealth   : "ALL GOOD" | "ALERT (n)"
 *   lastUpdated    : Timestamp
 * }
 *
 * system/config schema (future-ready):
 * {
 *   aprilTagEnabled : boolean
 *   fleetMode       : "autonomous" | "manual" | "hybrid"
 *   lastUpdated     : Timestamp
 * }
 * ============================================================
 */

import {
  COLLECTIONS,
  getDocument,
  setDocument,
  updateDocument,
  subscribeToDocument,
  serverTimestamp,
} from './firebaseService';

const SUMMARY_DOC = 'summary';
const CONFIG_DOC  = 'config';

// ─────────────────────────────────────────────────────────────
// READS
// ─────────────────────────────────────────────────────────────

/** One-shot fetch of the summary doc. */
export async function getAdminSummary() {
  return getDocument(COLLECTIONS.ADMIN, SUMMARY_DOC);
}

/** One-shot fetch of system config. */
export async function getSystemConfig() {
  return getDocument(COLLECTIONS.SYSTEM, CONFIG_DOC);
}

// ─────────────────────────────────────────────────────────────
// REAL-TIME LISTENERS
// ─────────────────────────────────────────────────────────────

/**
 * Subscribe to the admin summary document.
 * Used by the homepage to show live counts and system health.
 *
 * SCALABILITY: One listener, one tiny doc — extremely cheap.
 * This is the recommended pattern for dashboards.
 */
export function subscribeToAdminSummary(onData, onError) {
  return subscribeToDocument(COLLECTIONS.ADMIN, SUMMARY_DOC, onData, onError);
}

/** Subscribe to system config changes. */
export function subscribeToSystemConfig(onData, onError) {
  return subscribeToDocument(COLLECTIONS.SYSTEM, CONFIG_DOC, onData, onError);
}

// ─────────────────────────────────────────────────────────────
// WRITES
// ─────────────────────────────────────────────────────────────

/**
 * Recompute and overwrite the full admin summary.
 * Called by the seeder and by admin "recalculate" actions.
 * In production, a Cloud Function would do this on change events.
 */
export async function rebuildAdminSummary({ totalBots, totalArtifacts, activeAlerts }) {
  const health = activeAlerts === 0
    ? 'ALL GOOD'
    : `ALERT (${activeAlerts})`;

  await setDocument(COLLECTIONS.ADMIN, SUMMARY_DOC, {
    totalBots,
    totalArtifacts,
    activeAlerts,
    systemHealth: health,
    lastUpdated:  serverTimestamp(),
  }, { merge: false });
}

/**
 * Update system health label only (called after alert create/resolve).
 * Kept in sync with activeAlerts by alertService batch writes.
 */
export async function updateSystemHealth(activeAlerts) {
  const health = activeAlerts === 0
    ? 'ALL GOOD'
    : `ALERT (${activeAlerts})`;

  await updateDocument(COLLECTIONS.ADMIN, SUMMARY_DOC, {
    activeAlerts,
    systemHealth: health,
  });
}

/** Initialise the system/config document (run once by seeder). */
export async function initSystemConfig() {
  await setDocument(COLLECTIONS.SYSTEM, CONFIG_DOC, {
    aprilTagEnabled: false,   // flip to true when hardware is live
    fleetMode:       'autonomous',
    lastUpdated:     serverTimestamp(),
  }, { merge: false });
}
