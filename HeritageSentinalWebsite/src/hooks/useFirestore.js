/**
 * ============================================================
 * useFirestore.js  —  Custom React hooks for Firestore data
 * ============================================================
 * ARCHITECTURE DECISION: hooks are the bridge between services
 * and components. They own the useEffect/useState lifecycle so
 * that pages stay declarative.
 *
 * Pattern used:
 *   1. Set up listener inside useEffect
 *   2. Return unsubscribe from cleanup
 *   3. Expose { data, loading, error } to consumers
 *
 * Pages ONLY import from this file (or from service files for
 * imperative mutations). They never call Firestore APIs directly.
 * ============================================================
 */

import { useState, useEffect } from 'react';
import { subscribeToBots, subscribeToBot, subscribeToBotsByStatus } from '../services/botService';
import { subscribeToArtifacts, subscribeToArtifact } from '../services/artifactService';
import { subscribeToActiveAlerts, subscribeToRecentAlerts } from '../services/alertService';
import { subscribeToAdminSummary, subscribeToSystemConfig } from '../services/adminService';

// ─────────────────────────────────────────────────────────────
// INTERNAL HELPER
// Reduces boilerplate for every "subscribe once, return {data,
// loading, error}" hook pattern.
// ─────────────────────────────────────────────────────────────
function useSubscription(subscribeFn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsub = subscribeFn(
      result => { setData(result); setLoading(false); },
      err    => { setError(err);  setLoading(false); }
    );

    // Cleanup: unsubscribe from Firestore when component unmounts
    // or when deps change. This prevents memory leaks.
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}

// ─────────────────────────────────────────────────────────────
// BOT HOOKS
// ─────────────────────────────────────────────────────────────

/**
 * Real-time list of all bots.
 * Usage: const { data: bots, loading, error } = useBots();
 */
export function useBots() {
  return useSubscription(subscribeToBots);
}

/**
 * Real-time single bot by uid.
 * Usage: const { data: bot } = useBot('BOT_001');
 */
export function useBot(uid) {
  return useSubscription(
    (onData, onError) => subscribeToBot(uid, onData, onError),
    [uid]
  );
}

/**
 * Real-time bots filtered by status.
 * Usage: const { data: alertBots } = useBotsByStatus('alert');
 */
export function useBotsByStatus(status) {
  return useSubscription(
    (onData, onError) => subscribeToBotsByStatus(status, onData, onError),
    [status]
  );
}

// ─────────────────────────────────────────────────────────────
// ARTIFACT HOOKS
// ─────────────────────────────────────────────────────────────

/**
 * Real-time list of all artifacts.
 * Replaces the old useEffect+getDocs pattern in Artifacts.jsx.
 * Usage: const { data: artifacts, loading } = useArtifacts();
 */
export function useArtifacts() {
  return useSubscription(subscribeToArtifacts);
}

/**
 * Real-time single artifact by uid.
 * Usage: const { data: artifact } = useArtifact('ART_001');
 */
export function useArtifact(uid) {
  return useSubscription(
    (onData, onError) => subscribeToArtifact(uid, onData, onError),
    [uid]
  );
}

// ─────────────────────────────────────────────────────────────
// ALERT HOOKS
// ─────────────────────────────────────────────────────────────

/**
 * Real-time active (unresolved) alerts.
 * Usage: const { data: alerts } = useActiveAlerts();
 */
export function useActiveAlerts() {
  return useSubscription(subscribeToActiveAlerts);
}

/**
 * Real-time recent N alerts (all statuses, newest first).
 * Usage: const { data: log } = useRecentAlerts(20);
 */
export function useRecentAlerts(maxCount = 20) {
  return useSubscription(
    (onData, onError) => subscribeToRecentAlerts(maxCount, onData, onError),
    [maxCount]
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN HOOKS
// ─────────────────────────────────────────────────────────────

/**
 * Real-time admin summary (totalBots, totalArtifacts,
 * activeAlerts, systemHealth).
 *
 * This is the PRIMARY hook for the homepage dashboard.
 * One tiny document listener drives all four stat cards.
 *
 * Usage:
 *   const { data: summary } = useAdminSummary();
 *   summary.systemHealth  // "ALL GOOD" | "ALERT (n)"
 *   summary.activeAlerts  // number
 */
export function useAdminSummary() {
  return useSubscription(subscribeToAdminSummary);
}

/**
 * Real-time system config (aprilTagEnabled, fleetMode, etc.)
 * Usage: const { data: config } = useSystemConfig();
 */
export function useSystemConfig() {
  return useSubscription(subscribeToSystemConfig);
}
