/**
 * SIMPLE + ADVANCED PATH TRANSLATOR
 *
 * SIMPLE MODE:
 *   pathToInstructions()
 *   - perfect point turns
 *   - straight lines only
 *   - deterministic and easy to debug
 *
 * ADVANCED MODE:
 *   pathToAdvancedInstructions()
 *   - smoothed paths
 *   - velocity profiling
 *   - curved driving
 *   - future mecanum optimization
 */

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

const CM_PER_UNIT = 10;
const STEPS_PER_CM = 10;

const V_MAX = 40;
const V_MIN = 8;

const A_MAX = 30;
const D_MAX = 25;

const MAX_LATERAL_ACCEL = 35;

const POINT_TURN_DEG = 60;
const OMEGA_POINT_TURN = 40;

const CASTOR_SETTLE_MS = 350;
const CASTOR_FLIP_DEG = 90;

const LOOKAHEAD_UNITS = 5.0;

const MIN_SEGMENT_LENGTH = 0.5;
const MIN_TURN_DEGREES = 5;

const RDP_EPSILON = 0.8;

const MAX_CURVATURE = 1 / 120;

const FILLET_RADIUS = 2.5;
const FILLET_STEPS = 8;

// ─────────────────────────────────────────────────────────────
// GEOMETRY HELPERS
// ─────────────────────────────────────────────────────────────

function euclidean(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function add(a, b) {
  return {
    x: a.x + b.x,
    y: a.y + b.y
  };
}

function sub(a, b) {
  return {
    x: a.x - b.x,
    y: a.y - b.y
  };
}

function normalize(v) {
  const len = Math.hypot(v.x, v.y);

  return {
    x: v.x / len,
    y: v.y / len
  };
}

function angleBetween(a, b, c) {
  const ab = sub(a, b);
  const bc = sub(c, b);

  const dot =
    ab.x * bc.x +
    ab.y * bc.y;

  const mag =
    Math.hypot(ab.x, ab.y) *
    Math.hypot(bc.x, bc.y);

  return (
    Math.acos(
      Math.max(
        -1,
        Math.min(1, dot / mag)
      )
    ) *
    (180 / Math.PI)
  );
}

function isCorner(a, b, c, threshold = 8) {
  return angleBetween(a, b, c) > threshold;
}

/**
 * Bearing clockwise from north
 */
function bearing(from, to) {
  const rad = Math.atan2(
    to.x - from.x,
    -(to.y - from.y)   // ← negate dy to flip Y axis
  );
  return ((rad * 180 / Math.PI) + 360) % 360;
}

function shortestTurn(current, target) {
  return (
    ((target - current) + 540) %
    360 -
    180
  );
}

function unitsToSteps(u) {
  return Math.round(
    u *
    CM_PER_UNIT *
    STEPS_PER_CM
  );
}

function unitsToCm(u) {
  return Math.round(
    u * CM_PER_UNIT
  );
}

// ─────────────────────────────────────────────────────────────
// VELOCITY PROFILE
// ─────────────────────────────────────────────────────────────

function trapezoidalProfile(
  distCm,
  vEntry,
  vExit,
  vPeak
) {
  vEntry =
    Math.max(
      V_MIN,
      Math.min(vPeak, vEntry)
    );

  vExit =
    Math.max(
      V_MIN,
      Math.min(vPeak, vExit)
    );

  const dRampUp =
    (
      vPeak * vPeak -
      vEntry * vEntry
    ) /
    (2 * A_MAX);

  const dBrake =
    (
      vPeak * vPeak -
      vExit * vExit
    ) /
    (2 * D_MAX);

  const dAccelTotal =
    dRampUp + dBrake;

  let vActualPeak = vPeak;
  let dRamp = dRampUp;
  let dCoast = 0;
  let dBrakeActual = dBrake;

  if (dAccelTotal > distCm) {

    vActualPeak =
      Math.sqrt(
        distCm /
        (
          1 / (2 * A_MAX) +
          1 / (2 * D_MAX)
        )
      );

    vActualPeak =
      Math.max(
        V_MIN,
        Math.min(vPeak, vActualPeak)
      );

    dRamp =
      (
        vActualPeak * vActualPeak -
        vEntry * vEntry
      ) /
      (2 * A_MAX);

    dBrakeActual =
      distCm - dRamp;

  } else {

    dCoast =
      distCm - dAccelTotal;
  }

  const tRamp =
    dRamp > 0
      ? (vActualPeak - vEntry) / A_MAX
      : 0;

  const tCoast =
    dCoast > 0
      ? dCoast / vActualPeak
      : 0;

  const tBrake =
    dBrakeActual > 0
      ? (vActualPeak - vExit) / D_MAX
      : 0;

  return {
    vEntry,
    vPeak: Math.round(vActualPeak),
    vExit,

    dRamp: Math.round(dRamp),
    dCoast: Math.round(dCoast),
    dBrake: Math.round(dBrakeActual),

    durationMs:
      Math.round(
        (tRamp + tCoast + tBrake) *
        1000
      )
  };
}

function maxArcSpeedCm(radiusUnits) {

  const radiusCm =
    Math.max(
      radiusUnits * CM_PER_UNIT,
      1 / MAX_CURVATURE
    );

  const v =
    Math.sqrt(
      MAX_LATERAL_ACCEL *
      radiusCm
    );

  return Math.max(
    V_MIN,
    Math.min(V_MAX, v)
  );
}

// ─────────────────────────────────────────────────────────────
// RDP SIMPLIFICATION
// ─────────────────────────────────────────────────────────────

function rdpDist(p, a, b) {

  const dx = b.x - a.x;
  const dy = b.y - a.y;

  const lenSq =
    dx * dx + dy * dy;

  if (lenSq < 1e-12) {
    return euclidean(p, a);
  }

  const t =
    Math.max(
      0,
      Math.min(
        1,
        (
          ((p.x - a.x) * dx) +
          ((p.y - a.y) * dy)
        ) / lenSq
      )
    );

  return euclidean(
    p,
    {
      x: a.x + t * dx,
      y: a.y + t * dy
    }
  );
}

function rdp(points, eps) {

  if (points.length <= 2) {
    return points;
  }

  let max = 0;
  let idx = 0;

  for (
    let i = 1;
    i < points.length - 1;
    i++
  ) {

    const d =
      rdpDist(
        points[i],
        points[0],
        points[points.length - 1]
      );

    if (d > max) {
      max = d;
      idx = i;
    }
  }

  if (max > eps) {

    const left =
      rdp(
        points.slice(0, idx + 1),
        eps
      );

    const right =
      rdp(
        points.slice(idx),
        eps
      );

    return [
      ...left.slice(0, -1),
      ...right
    ];
  }

  return [
    points[0],
    points[points.length - 1]
  ];
}

// ─────────────────────────────────────────────────────────────
// FILLET BUILDING
// ─────────────────────────────────────────────────────────────

function buildFillet(
  p0,
  p1,
  p2,
  radius = FILLET_RADIUS,
  steps = FILLET_STEPS
) {

  const v1 =
    normalize(
      sub(p0, p1)
    );

  const v2 =
    normalize(
      sub(p2, p1)
    );

  const dot =
    v1.x * v2.x +
    v1.y * v2.y;

  const angle =
    Math.acos(
      Math.max(
        -1,
        Math.min(1, dot)
      )
    );

  const b1 = bearing(p1, p0);
  const b2 = bearing(p1, p2);

  const turn =
    ((b2 - b1 + 540) % 360) - 180;

  if (Math.abs(turn) < 1) {
    return {
      start: p1,
      end: p1,
      arc: [p1],
      turnDeg: 0
    };
  }

  const seg1Len =
    euclidean(p0, p1);

  const seg2Len =
    euclidean(p1, p2);

  const maxTan =
    Math.min(seg1Len, seg2Len) *
    0.4;

  const rawTan =
    radius /
    Math.tan(angle / 2);

  const tanLen =
    Math.min(rawTan, maxTan);

  const start =
    add(
      p1,
      {
        x: v1.x * tanLen,
        y: v1.y * tanLen
      }
    );

  const end =
    add(
      p1,
      {
        x: v2.x * tanLen,
        y: v2.y * tanLen
      }
    );

  const bis =
    normalize({
      x: v1.x + v2.x,
      y: v1.y + v2.y
    });

  const centerDist =
    radius /
    Math.sin(angle / 2);

  const center =
    add(
      p1,
      {
        x: bis.x * centerDist,
        y: bis.y * centerDist
      }
    );

  let startAng =
    Math.atan2(
      start.y - center.y,
      start.x - center.x
    );

  let endAng =
    Math.atan2(
      end.y - center.y,
      end.x - center.x
    );

  let delta =
    endAng - startAng;

  if (turn < 0 && delta > 0) {
    delta -= Math.PI * 2;
  }

  if (turn > 0 && delta < 0) {
    delta += Math.PI * 2;
  }

  const arc = [];

  for (let i = 0; i <= steps; i++) {

    const t = i / steps;

    const ang =
      startAng + delta * t;

    arc.push({
      x:
        center.x +
        radius * Math.cos(ang),

      y:
        center.y +
        radius * Math.sin(ang)
    });
  }

  return {
    start,
    end,
    arc,
    turnDeg: Math.abs(turn)
  };
}

// ─────────────────────────────────────────────────────────────
// PATH SMOOTHING
// ─────────────────────────────────────────────────────────────

function splitIntoCornerSegments(points) {

  const segments = [];

  let current = [points[0]];

  for (
    let i = 1;
    i < points.length - 1;
    i++
  ) {

    current.push(points[i]);

    if (
      isCorner(
        points[i - 1],
        points[i],
        points[i + 1]
      )
    ) {

      segments.push(current);
      current = [points[i]];
    }
  }

  current.push(
    points[points.length - 1]
  );

  segments.push(current);

  return segments;
}

export function smoothPath(path) {

  if (!path || path.length < 2) {
    return path;
  }

  const start = path[0];
  const goal = path[path.length - 1];

  const inner =
    path.filter(
      n =>
        n.id !== '__start__' &&
        n.id !== '__goal__'
    );

  const raw = [
    {
      x: start.x,
      y: start.y
    }
  ];

  for (const n of inner) {

    if (
      euclidean(
        raw[raw.length - 1],
        n
      ) > MIN_SEGMENT_LENGTH
    ) {

      raw.push({
        x: n.x,
        y: n.y
      });
    }
  }

  raw.push({
    x: goal.x,
    y: goal.y
  });

  const ctrl =
    rdp(raw, RDP_EPSILON);

  const segments =
    splitIntoCornerSegments(ctrl);

  const out = [{ ...ctrl[0] }];

  for (
    let s = 0;
    s < segments.length;
    s++
  ) {

    const seg = segments[s];

    for (
      let i = 1;
      i < seg.length - 1;
      i++
    ) {
      out.push(seg[i]);
    }

    if (
      s < segments.length - 1 &&
      seg.length >= 2
    ) {

      const p0 =
        seg[seg.length - 2];

      const p1 =
        seg[seg.length - 1];

      const p2 =
        segments[s + 1][1];

      const fillet =
        buildFillet(p0, p1, p2);

      out.push(
        ...fillet.arc.slice(1)
      );
    }
  }

  out.push({ ...goal });

  return out.map((p, i) => ({
    id:
      i === 0
        ? (start.id ?? '__start__')
        : i === out.length - 1
          ? (goal.id ?? '__goal__')
          : `p_${i}`,

    x: p.x,
    y: p.y
  }));
}

// ─────────────────────────────────────────────────────────────
// ADVANCED CLASSIFIER
// ─────────────────────────────────────────────────────────────

function classifySegments(waypoints) {

  if (waypoints.length < 2) {
    return [];
  }

  const segs = [];

  let currentBearing =
    bearing(
      waypoints[0],
      waypoints[1]
    );

  for (
    let i = 0;
    i < waypoints.length - 1;
    i++
  ) {

    const from = waypoints[i];
    const to = waypoints[i + 1];

    const dist =
      euclidean(from, to);

    if (dist < MIN_SEGMENT_LENGTH) {
      continue;
    }

    const segBearing =
      bearing(from, to);

    const delta =
      shortestTurn(
        currentBearing,
        segBearing
      );

    if (
      i > 0 &&
      Math.abs(delta) >=
      MIN_TURN_DEGREES
    ) {

      if (
        Math.abs(delta) >=
        POINT_TURN_DEG
      ) {

        segs.push({
          type: 'point_turn',

          turnDeg:
            Math.abs(delta),

          direction:
            delta >= 0
              ? 'RIGHT'
              : 'LEFT',

          fromId: from.id,
          toId: to.id
        });

      } else {

        segs.push({
          type: 'arc_drive',

          turnDeg:
            Math.abs(delta),

          direction:
            delta >= 0
              ? 'RIGHT'
              : 'LEFT',

          radiusUnits:
            FILLET_RADIUS,

          fromId: from.id,
          toId: to.id
        });
      }
    }

    segs.push({
      type: 'straight',

      distUnits: dist,

      headingDeg:
        Math.round(segBearing),

      fromId: from.id,
      toId: to.id
    });

    currentBearing = segBearing;
  }

  return segs;
}

// ─────────────────────────────────────────────────────────────
// ADVANCED VELOCITY PLANNER
// ─────────────────────────────────────────────────────────────

function velocityPlan(classifiedSegs) {

  if (!classifiedSegs.length) {
    return [];
  }

  const instructions = [];

  let vCurrent = V_MIN;

  for (const seg of classifiedSegs) {

    if (seg.type === 'straight') {

      const distCm =
        seg.distUnits *
        CM_PER_UNIT;

      const profile =
        trapezoidalProfile(
          distCm,
          vCurrent,
          V_MIN,
          V_MAX
        );

      instructions.push({
        type: 'RAMP_FORWARD',

        steps:
          unitsToSteps(
            seg.distUnits
          ),

        distanceCm:
          unitsToCm(
            seg.distUnits
          ),

        heading:
          seg.headingDeg,

        nodeFrom:
          seg.fromId,

        nodeTo:
          seg.toId,

        ...profile
      });

      vCurrent = profile.vExit;
    }

    else if (
      seg.type === 'arc_drive'
    ) {

      const curveSpeed =
        maxArcSpeedCm(
          seg.radiusUnits
        );

      const radiusCm =
        seg.radiusUnits *
        CM_PER_UNIT;

      const turnRad =
        seg.turnDeg *
        Math.PI /
        180;

      const arcLenCm =
        Math.round(
          radiusCm * turnRad
        );

      const omegaDeg =
        Math.round(
          (
            curveSpeed /
            radiusCm
          ) *
          (180 / Math.PI)
        );

      instructions.push({
        type: 'ARC_DRIVE',

        direction:
          seg.direction,

        turnDeg:
          Math.round(
            seg.turnDeg
          ),

        radiusCm,

        speedCmS:
          Math.round(
            curveSpeed
          ),

        omegaDeg,

        arcLenCm,

        durationMs:
          Math.round(
            (
              arcLenCm /
              curveSpeed
            ) * 1000
          ),

        nodeFrom:
          seg.fromId,

        nodeTo:
          seg.toId
      });

      vCurrent = curveSpeed;
    }

    else if (
      seg.type === 'point_turn'
    ) {

      if (
        seg.turnDeg >=
        CASTOR_FLIP_DEG
      ) {

        instructions.push({
          type:
            'CASTOR_SETTLE',

          durationMs:
            CASTOR_SETTLE_MS,

          reason:
            'castor realignment before large turn'
        });
      }

      instructions.push({
        type: 'POINT_TURN',

        degrees:
          Math.round(
            seg.turnDeg
          ),

        direction:
          seg.direction,

        omega:
          OMEGA_POINT_TURN,

        durationMs:
          Math.round(
            (
              seg.turnDeg /
              OMEGA_POINT_TURN
            ) * 1000
          ),

        nodeFrom:
          seg.fromId,

        nodeTo:
          seg.toId
      });

      vCurrent = V_MIN;
    }
  }

  instructions.push({
    type: 'STOP',
    reason:
      'destination reached'
  });

  return instructions;
}

// ─────────────────────────────────────────────────────────────
// SIMPLE PLANNER
// ─────────────────────────────────────────────────────────────

/**
 * SIMPLE deterministic planner
 *
 * - point turn
 * - straight
 * - repeat
 *
 * NO smoothing
 * NO curves
 * NO ramps
 */function mergeCollinear(path, angleTolerance = 2) {
  if (path.length <= 2) return path;
  const out = [path[0]];
  for (let i = 1; i < path.length - 1; i++) {
    const prev = out[out.length - 1];
    const curr = path[i];
    const next = path[i + 1];
    const b1 = bearing(prev, curr);
    const b2 = bearing(curr, next);
    if (Math.abs(shortestTurn(b1, b2)) > angleTolerance) {
      out.push(curr); // it's a real turn, keep it
    }
    // else skip — collinear, don't push
  }
  out.push(path[path.length - 1]);
  return out;
}
export function pathToInstructions(
  path,
  initialBearing = 0
) {
  path = mergeCollinear(path);
  if (!path || path.length < 2) {

    return [
      {
        type: 'STOP',
        reason:
          'already at destination'
      }
    ];
  }

  const instructions = [];

  let currentBearing =
    initialBearing;

  for (
    let i = 0;
    i < path.length - 1;
    i++
  ) {

    const from = path[i];
    const to = path[i + 1];

    const segBearing =
      bearing(from, to);

    const turn =
      shortestTurn(
        currentBearing,
        segBearing
      );

    // TURN FIRST
    if (
      Math.abs(turn) >=
      MIN_TURN_DEGREES
    ) {

      instructions.push({
        type: 'POINT_TURN',

        degrees:
          Math.round(
            Math.abs(turn)
          ),

        direction:
          turn >= 0
            ? 'RIGHT'
            : 'LEFT',

        omega:
          OMEGA_POINT_TURN,

        durationMs:
          Math.round(
            (
              Math.abs(turn) /
              OMEGA_POINT_TURN
            ) * 1000
          )
      });
    }

    // DRIVE STRAIGHT
    const dist =
      euclidean(from, to);

    instructions.push({
      type: 'FORWARD',

      steps:
        unitsToSteps(dist),

      distanceCm:
        unitsToCm(dist),

      heading:
        Math.round(segBearing),

      nodeFrom: from.id,
      nodeTo: to.id
    });

    currentBearing =
      segBearing;
  }

  instructions.push({
    type: 'STOP',
    reason:
      'destination reached'
  });

  return instructions;
}

// ─────────────────────────────────────────────────────────────
// ADVANCED PLANNER
// ─────────────────────────────────────────────────────────────

/**
 * ADVANCED smoother planner
 *
 * - smoothing
 * - velocity profiling
 * - curves
 * - future mecanum motion
 */
export function pathToAdvancedInstructions(
  rawPath,
  initialBearing = 0
) {

  if (!rawPath || rawPath.length < 2) {

    return [
      {
        type: 'STOP',
        reason:
          'already at destination'
      }
    ];
  }

  const smooth =
    smoothPath(rawPath);

  const waypoints = [smooth[0]];

  for (
    let i = 1;
    i < smooth.length;
    i++
  ) {

    if (
      euclidean(
        smooth[i - 1],
        smooth[i]
      ) >= MIN_SEGMENT_LENGTH
    ) {

      waypoints.push(
        smooth[i]
      );
    }
  }

  const result = [];

  const firstBearing =
    bearing(
      waypoints[0],
      waypoints[1]
    );

  const initialTurn =
    shortestTurn(
      initialBearing,
      firstBearing
    );

  if (
    Math.abs(initialTurn) >=
    MIN_TURN_DEGREES
  ) {

    result.push({
      type: 'FACE',

      degrees:
        Math.round(
          firstBearing
        ),

      turn:
        Math.round(
          initialTurn
        ),

      direction:
        initialTurn >= 0
          ? 'RIGHT'
          : 'LEFT',

      omega:
        OMEGA_POINT_TURN,

      durationMs:
        Math.round(
          (
            Math.abs(initialTurn) /
            OMEGA_POINT_TURN
          ) * 1000
        )
    });
  }

  const segments =
    classifySegments(
      waypoints
    );

  const instructions =
    velocityPlan(
      segments
    );

  return [
    ...result,
    ...instructions
  ];
}

// ─────────────────────────────────────────────────────────────
// DEBUG STRING
// ─────────────────────────────────────────────────────────────

export function instructionsToString(
  instructions
) {

  return instructions
    .map((ins, i) => {

      const n = i + 1;

      switch (ins.type) {

        case 'FORWARD':

          return (
            `${n}. FORWARD ` +
            `${ins.steps} steps ` +
            `(~${ins.distanceCm}cm)` +
            ` heading ${ins.heading}°`
          );

        case 'POINT_TURN':

          return (
            `${n}. POINT_TURN ` +
            `${ins.direction} ` +
            `${ins.degrees}°`
          );

        case 'FACE':

          return (
            `${n}. FACE ` +
            `${ins.degrees}°`
          );

        case 'RAMP_FORWARD':

          return (
            `${n}. RAMP_FORWARD ` +
            `${ins.distanceCm}cm`
          );

        case 'ARC_DRIVE':

          return (
            `${n}. ARC_DRIVE ` +
            `${ins.direction} ` +
            `${ins.turnDeg}°`
          );

        case 'CASTOR_SETTLE':

          return (
            `${n}. CASTOR_SETTLE`
          );

        case 'STOP':

          return (
            `${n}. STOP`
          );

        default:

          return (
            `${n}. UNKNOWN`
          );
      }
    })
    .join('\n');
}

// ─────────────────────────────────────────────────────────────
// SVG PATH
// ─────────────────────────────────────────────────────────────

export function pathToSvgD(pts) {

  if (!pts || pts.length < 2) {
    return '';
  }

  let d =
    `M ${pts[0].x} ${pts[0].y}`;

  for (
    let i = 1;
    i < pts.length;
    i++
  ) {

    d +=
      ` L ${pts[i].x} ${pts[i].y}`;
  }

  return d;
}

// ─────────────────────────────────────────────────────────────
// PURE PURSUIT
// ─────────────────────────────────────────────────────────────

const ARRIVE_THRESHOLD =
  1 / STEPS_PER_CM;

export function purePursuitStep(
  robotPose,
  path,
  cursorHint = 0
) {

  if (!path || path.length < 2) {

    return {
      done: true,
      steerDeg: 0,
      direction: 'STRAIGHT',
      lookahead: null,
      cursor: 0
    };
  }

  const goal =
    path[path.length - 1];

  if (
    euclidean(robotPose, goal) <=
    ARRIVE_THRESHOLD
  ) {

    return {
      done: true,
      steerDeg: 0,
      direction: 'STRAIGHT',
      lookahead: goal,
      cursor: path.length - 1
    };
  }

  let cursor =
    Math.max(0, cursorHint);

  while (
    cursor < path.length - 2 &&
    euclidean(
      robotPose,
      path[cursor + 1]
    ) <=
    euclidean(
      robotPose,
      path[cursor]
    )
  ) {
    cursor++;
  }

  let remaining =
    LOOKAHEAD_UNITS;

  let lookahead = null;

  for (
    let i = cursor;
    i < path.length - 1;
    i++
  ) {

    const segLen =
      euclidean(
        path[i],
        path[i + 1]
      );

    if (remaining <= segLen) {

      const t =
        remaining / segLen;

      lookahead = {

        x:
          path[i].x +
          (
            path[i + 1].x -
            path[i].x
          ) * t,

        y:
          path[i].y +
          (
            path[i + 1].y -
            path[i].y
          ) * t
      };

      break;
    }

    remaining -= segLen;
  }

  if (!lookahead) {
    lookahead = goal;
  }

  const targetBearing =
    bearing(
      robotPose,
      lookahead
    );

  const steerSigned =
    shortestTurn(
      robotPose.bearing,
      targetBearing
    );

  const steerDeg =
    Math.abs(steerSigned);

  const direction =
    steerDeg < MIN_TURN_DEGREES
      ? 'STRAIGHT'
      : steerSigned > 0
        ? 'RIGHT'
        : 'LEFT';

  return {
    done: false,
    steerDeg:
      Math.round(steerDeg),

    direction,

    lookahead,

    cursor
  };
}