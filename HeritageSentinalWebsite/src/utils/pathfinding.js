import { NAV_NODES, LOCATIONS, ZONE_RECTS, ZONE_NODE_KEYS as ZONE_NODE_KEYS_RAW } from './mapData';
import { instructionsToString, pathToInstructions } from './pathTranslator';

// ─────────────────────────────────────────────────────────────
// ZONE_NODE_KEYS comes from JSON as { zoneId: [nodeId, ...] }
// Reconstruct as Map<string, Set<string>> so .get() and .has()
// work correctly. Corridors only have spine node IDs in the set.
// ─────────────────────────────────────────────────────────────
const ZONE_NODE_KEYS = new Map(
  Object.entries(ZONE_NODE_KEYS_RAW).map(([id, arr]) => [id, new Set(arr)])
);

// ─────────────────────────────────────────────────────────────
// GRAPH CACHE
// ─────────────────────────────────────────────────────────────

const NAV_BY_ID = new Map(NAV_NODES.map(n => [n.id, n]));

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getNode(id) {
  return NAV_BY_ID.get(id);
}

/**
 * Find the 1-3 best gateway nodes for a position.
 *
 * For corridor zones we must NOT fall back to bbox-filtering because
 * corridor nodes only exist on the spine — the bbox contains no
 * non-spine nodes. We use ZONE_NODE_KEYS (the exact set built during
 * map generation) so corridors return only their spine nodes.
 */
function gatewaysFor(pos) {
  const EPS = 1e-6;

// In gatewaysFor(), replace the .find() sort:

const zone = [...ZONE_RECTS]
  .sort((a, b) => {
    // Prefer non-corridors; among same type, prefer smaller area
    const aCorridor = a.id.toLowerCase().includes('corridor');
    const bCorridor = b.id.toLowerCase().includes('corridor');
    if (aCorridor !== bCorridor) return aCorridor ? 1 : -1;
    return ((a.x2 - a.x1) * (a.y2 - a.y1)) - ((b.x2 - b.x1) * (b.y2 - b.y1));
  })
  .find(z =>
    pos.x >= z.x1 - EPS && pos.x <= z.x2 + EPS &&
    pos.y >= z.y1 - EPS && pos.y <= z.y2 + EPS
  );

  // allowedKeys is the Set of node IDs that actually belong to this zone
  // (spine-only for corridors, full grid for rooms)
  const allowedKeys = zone ? ZONE_NODE_KEYS.get(zone.id) : null;

  return [...NAV_NODES]
    .filter(n => !allowedKeys || allowedKeys.has(n.id))
    .filter(n => n.neighbors.length > 0)   // exclude completely isolated nodes
    .sort((a, b) => Math.hypot(a.x - pos.x, a.y - pos.y) - Math.hypot(b.x - pos.x, b.y - pos.y))
    .slice(0, 3)
    .map(n => n.id);
}

// ─────────────────────────────────────────────────────────────
// HEADING-AWARE COST CONFIG
// ─────────────────────────────────────────────────────────────
const TURN_PENALTY = 0.1;

// ─────────────────────────────────────────────────────────────
// A*
// ─────────────────────────────────────────────────────────────

function astar(startPos, targetPos) {
  const startGateways = gatewaysFor(startPos);
  const goalGateways  = gatewaysFor(targetPos);

  const vStart = { id: '__start__', x: startPos.x, y: startPos.y, neighbors: startGateways };
  const vGoal  = { id: '__goal__',  x: targetPos.x, y: targetPos.y, neighbors: [] };

  // Augment goal-gateway nodes with a back-edge to __goal__
  const augmented = new Map();
  for (const id of goalGateways) {
    const n = getNode(id);
    if (n) augmented.set(id, { ...n, neighbors: [...n.neighbors, '__goal__'] });
  }

  function lookup(id) {
    if (id === '__start__') return vStart;
    if (id === '__goal__')  return vGoal;
    return augmented.get(id) ?? getNode(id);
  }

  const h = node => dist(node, vGoal);

function edgeBearing(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  return ((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360;
}

  function bearingDelta(b1, b2) {
    return Math.abs(((b2 - b1) + 540) % 360 - 180);
  }

  const openSet  = new Set(['__start__']);
  const cameFrom = new Map();
  const gScore   = new Map([['__start__', 0]]);
  const fScore   = new Map([['__start__', h(vStart)]]);
  const inBearing = new Map([['__start__', null]]);

  function g(id) { return gScore.get(id) ?? Infinity; }
  function f(id) { return fScore.get(id) ?? Infinity; }

  while (openSet.size > 0) {
    let current = null, bestF = Infinity;
    for (const id of openSet) {
      const fv = f(id);
      if (fv < bestF) { bestF = fv; current = id; }
    }

    if (current === '__goal__') {
      const ids = [];
      let c = current;
      while (c !== undefined) { ids.unshift(c); c = cameFrom.get(c); }
      return ids.map(id => {
        const n = lookup(id);
        return n ? { id, x: n.x, y: n.y } : null;
      }).filter(Boolean);
    }

    openSet.delete(current);
    const currentNode = lookup(current);
    if (!currentNode) continue;

    const curBearing = inBearing.get(current);

    for (const nid of (currentNode.neighbors ?? [])) {
      const neighbor = lookup(nid);
      if (!neighbor) continue;

      const segDist    = dist(currentNode, neighbor);
      const segBearing = edgeBearing(currentNode, neighbor);
      const turnDeg    = curBearing !== null ? bearingDelta(curBearing, segBearing) : 0;
      const tentG      = g(current) + segDist + turnDeg * TURN_PENALTY;

      if (tentG < g(nid)) {
        cameFrom.set(nid, current);
        gScore.set(nid, tentG);
        fScore.set(nid, tentG + h(neighbor));
        inBearing.set(nid, segBearing);
        openSet.add(nid);
      }
    }
  }

  console.log('A* failed. start gateways:', startGateways, '| goal gateways:', goalGateways);
  return [];
}

// ─────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────

export function findPath(startPos, targetPos, { includeRaw = true } = {}) {
  const startGateways = gatewaysFor(startPos);
  const goalGateways  = gatewaysFor(targetPos);
  console.log('start gateways:', startGateways);
  console.log('goal gateways:',  goalGateways);

  if (dist(startPos, targetPos) < 0.0001) {
    return {
      path: includeRaw
        ? [{ id: '__start__', ...startPos }, { id: '__goal__', ...targetPos }]
        : [],
      totalDistance: 0
    };
  }

  const rawPath = astar(startPos, targetPos);
  console.log('raw path:', rawPath.map(n => n.id));

  if (rawPath.length === 0) return { path: [], totalDistance: 0 };

  const internal = rawPath.filter(n => n.id !== '__start__' && n.id !== '__goal__');
  const path = [];
  if (includeRaw) path.push({ id: '__start__', x: startPos.x, y: startPos.y });
  path.push(...internal);
  if (includeRaw) path.push({ id: '__goal__',  x: targetPos.x, y: targetPos.y });

  let totalDistance = 0;
  for (let i = 1; i < path.length; i++) totalDistance += dist(path[i - 1], path[i]);

  return { path, totalDistance };
}

export function getNearestLocation(x, y) {
  const pos = { x, y };
  return LOCATIONS.reduce((best, loc) =>
    dist(pos, loc.center) < dist(pos, best.center) ? loc : best
  );
}

export function debugPath(startPos, targetPos) {
  const result       = findPath(startPos, targetPos);
  const instructions = pathToInstructions(result.path, robot.currentBearing ?? 0);
  console.log('\n========== PATH ==========');
  console.log(result.path.map(n => n.id).join(' → '));
  console.log(`Total distance: ${result.totalDistance.toFixed(2)}`);
  console.log('\n====== INSTRUCTIONS ======');
  console.log(instructionsToString(instructions));
  return { ...result, instructions };
}