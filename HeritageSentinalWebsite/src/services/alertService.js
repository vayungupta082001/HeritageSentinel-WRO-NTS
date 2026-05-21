/**
 * ============================================================
 * alertService.js
 * ============================================================
 * ARCHITECTURE DECISION: Domain service for /alerts collection.
 *
 * Alerts are created by bots or admin logic when something
 * needs human attention. They also drive the system health
 * indicator on the homepage.
 *
 * Alert schema (Firestore document structure):
 * {
 *   uid        : string   — auto-generated doc ID
 *   type       : string   — "bot_offline"|"low_battery"|"security"|"maintenance"|"custom"
 *   severity   : string   — "info"|"warning"|"critical"
 *   botUid     : string | null   — which bot triggered this
 *   artifactUid: string | null   — related artifact (if any)
 *   message    : string
 *   resolved   : boolean
 *   createdAt  : Timestamp
 *   resolvedAt : Timestamp | null
 *   lastUpdated: Timestamp
 * }
 * ============================================================
 */

import {
  COLLECTIONS,
  getCollection,
  updateDocument,
  subscribeToCollection,
  runBatch,
  serverTimestamp,
  where,
  orderBy,
  limit,
  db,
  doc,
  collection,
  increment,
} from './firebaseService';
import { addDoc } from 'firebase/firestore';

export const ALERT_TYPES = ['bot_offline', 'low_battery', 'security', 'maintenance', 'custom'];
export const ALERT_SEVERITIES = ['info', 'warning', 'critical'];

// ─────────────────────────────────────────────────────────────
// READS
// ─────────────────────────────────────────────────────────────

/** One-shot: all unresolved alerts. */
export async function getActiveAlerts() {
  // For a one-shot count, getDocs with filter is cheapest.
  const all = await getCollection(COLLECTIONS.ALERTS);
  return all.filter(a => !a.resolved);
}

// ─────────────────────────────────────────────────────────────
// REAL-TIME LISTENERS
// ─────────────────────────────────────────────────────────────

/**
 * Subscribe to ALL unresolved alerts, newest first.
 * Used by the homepage health indicator and admin dashboard.
 *
 * Requires a Firestore composite index:
 *   Collection: alerts
 *   Fields: resolved (ASC), createdAt (DESC)
 */
export function subscribeToActiveAlerts(onData, onError) {
  return subscribeToCollection(
    COLLECTIONS.ALERTS,
    onData,
    onError,
    [where('resolved', '==', false), orderBy('createdAt', 'desc')]
  );
}

/**
 * Subscribe to the N most recent alerts (all statuses).
 * Useful for an activity log panel.
 */
export function subscribeToRecentAlerts(maxCount, onData, onError) {
  return subscribeToCollection(
    COLLECTIONS.ALERTS,
    onData,
    onError,
    [orderBy('createdAt', 'desc'), limit(maxCount)]
  );
}

/** Subscribe to alerts for a specific bot. */
export function subscribeToBotAlerts(botUid, onData, onError) {
  return subscribeToCollection(
    COLLECTIONS.ALERTS,
    onData,
    onError,
    [where('botUid', '==', botUid), where('resolved', '==', false)]
  );
}

// ─────────────────────────────────────────────────────────────
// WRITES
// ─────────────────────────────────────────────────────────────

/**
 * Create a new alert.
 * Also increments the admin/summary.activeAlerts counter
 * (and the artifact's alertCount if artifactUid is supplied)
 * in a single atomic batch.
 *
 * @returns the new alert's document ID
 */
export async function createAlert({ type, severity, botUid, artifactUid, message }) {
  if (!ALERT_TYPES.includes(type))       throw new Error(`Unknown alert type: ${type}`);
  if (!ALERT_SEVERITIES.includes(severity)) throw new Error(`Unknown severity: ${severity}`);

  // addDoc generates a unique ID — we capture it for the return value.
  const alertRef = await addDoc(collection(db, COLLECTIONS.ALERTS), {
    type,
    severity,
    botUid:      botUid      ?? null,
    artifactUid: artifactUid ?? null,
    message,
    resolved:    false,
    createdAt:   serverTimestamp(),
    resolvedAt:  null,
    lastUpdated: serverTimestamp(),
  });

  // Atomic increment of admin summary + optional artifact alertCount
  await runBatch(batch => {
    const summaryRef = doc(db, COLLECTIONS.ADMIN, 'summary');
    batch.update(summaryRef, {
      activeAlerts: increment(1),
      lastUpdated:  serverTimestamp(),
    });

    if (artifactUid) {
      const artRef = doc(db, COLLECTIONS.ARTIFACTS, artifactUid);
      batch.update(artRef, {
        alertCount:  increment(1),
        lastUpdated: serverTimestamp(),
      });
    }
  });

  return alertRef.id;
}

/**
 * Resolve (close) an alert.
 * Decrements admin/summary.activeAlerts atomically.
 */
export async function resolveAlert(alertUid) {
  await runBatch(batch => {
    const alertRef   = doc(db, COLLECTIONS.ALERTS, alertUid);
    const summaryRef = doc(db, COLLECTIONS.ADMIN,  'summary');

    batch.update(alertRef, {
      resolved:    true,
      resolvedAt:  serverTimestamp(),
      lastUpdated: serverTimestamp(),
    });

    batch.update(summaryRef, {
      activeAlerts: increment(-1),
      lastUpdated:  serverTimestamp(),
    });
  });
}

/**
 * Bulk-resolve all active alerts (admin "clear all" action).
 * Firestore batches are limited to 500 writes — for fleets with
 * > 490 simultaneous alerts, chunk this into multiple batches.
 */
export async function resolveAllAlerts() {
  const active = await getActiveAlerts();
  if (!active.length) return;

  await runBatch(batch => {
    for (const alert of active) {
      const ref = doc(db, COLLECTIONS.ALERTS, alert.id);
      batch.update(ref, {
        resolved:    true,
        resolvedAt:  serverTimestamp(),
        lastUpdated: serverTimestamp(),
      });
    }
    const summaryRef = doc(db, COLLECTIONS.ADMIN, 'summary');
    batch.update(summaryRef, {
      activeAlerts: 0,
      lastUpdated:  serverTimestamp(),
    });
  });
}
