import { useEffect, useRef, useState, useCallback } from 'react';

// Heritage palette
const PALETTE = {
  bg:         '#faf3e0',
  panel:      '#fcfaf2',
  panelAlt:   '#f5ead0',
  border:     '#e8d9b8',
  borderSoft: '#efe2c4',
  accent:     '#b87a1a',
  accentSoft: '#d6a458',
  accentBg:   'rgba(184,122,26,0.10)',
  text:       '#3a2b1a',
  textMuted:  '#8a7758',
  danger:     '#b04a2b',
  success:    '#6b8a3a',
  canvasBg:   '#f0e4c8',
  waypoint:   '#4a7ab0',
  waypointBg: 'rgba(74,122,176,0.12)',
};

const SERIF = "'Cormorant Garamond', 'Playfair Display', Georgia, serif";
const SANS  = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const ZONE_COLORS = [
  '#b87a1a','#7a8a4a','#4a7a8a','#a85a6a','#b89a4a',
  '#c46a40','#5a8ab0','#7a9a4a','#a05a8a','#4a9a8a'
];

export default function MapGenerator({ language, switchLanguage }) {
  const canvasRef      = useRef(null);
  const bgImgRef       = useRef(null);
  const canvasWrapRef  = useRef(null);
  const fileInputRef   = useRef(null);

  const [imageLoaded, setImageLoaded]   = useState(false);
  const [imageSrc, setImageSrc]         = useState(null);
  const [zones, setZones]               = useState([]);
  const [waypoints, setWaypoints]       = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [tool, setToolState]            = useState('draw');
  const [gridStep, setGridStep]         = useState(1);
  const [showGrid, setShowGrid]         = useState(true);
  const [generatedCode, setGeneratedCode] = useState('');
  const [status, setStatus]             = useState({ msg: 'Ready', type: 'idle' });
  const [showOutput, setShowOutput]     = useState(false);
  const [nextId, setNextId]             = useState(1);
  const [pendingWaypoint, setPendingWaypoint] = useState(null);
  const [waypointName, setWaypointName] = useState('');
  const waypointInputRef = useRef(null);

  const toolRef          = useRef('draw');
  const zonesRef         = useRef([]);
  const waypointsRef     = useRef([]);
  const selectedZoneRef  = useRef(null);
  const drawingRef       = useRef(false);
  const drawStartRef     = useRef(null);
  const dragStartRef     = useRef(null);
  const dragOriginRef    = useRef(null);
  const nextIdRef        = useRef(1);
  const gridStepRef      = useRef(1);
  const showGridRef      = useRef(true);
  const pendingWaypointRef = useRef(null);

  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { zonesRef.current = zones; }, [zones]);
  useEffect(() => { waypointsRef.current = waypoints; }, [waypoints]);
  useEffect(() => { selectedZoneRef.current = selectedZone; }, [selectedZone]);
  useEffect(() => { gridStepRef.current = gridStep; }, [gridStep]);
  useEffect(() => { showGridRef.current = showGrid; }, [showGrid]);
  useEffect(() => { pendingWaypointRef.current = pendingWaypoint; }, [pendingWaypoint]);

  function snapPct(v, step) { return Math.round(v / step) * step; }
  function pctToCanvas(px, py, canvas) { return { x: px / 100 * canvas.width, y: py / 100 * canvas.height }; }
  function canvasToPct(cx, cy, canvas) { return { x: cx / canvas.width * 100, y: cy / canvas.height * 100 }; }
  function getCanvasPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top)  * (canvas.height / rect.height)
    };
  }
  function hitTest(pos, canvas, zones) {
    const pct = canvasToPct(pos.x, pos.y, canvas);
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      if (pct.x >= z.x1 && pct.x <= z.x2 && pct.y >= z.y1 && pct.y <= z.y2) return z;
    }
    return null;
  }

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (showGridRef.current) {
      const step = gridStepRef.current;
      ctx.save();
      ctx.strokeStyle = 'rgba(184,122,26,0.15)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= 100; x += step) {
        const cx = x / 100 * canvas.width;
        ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, canvas.height); ctx.stroke();
      }
      for (let y = 0; y <= 100; y += step) {
        const cy = y / 100 * canvas.height;
        ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(canvas.width, cy); ctx.stroke();
      }
      ctx.restore();
    }

    for (const z of zonesRef.current) {
      const a = pctToCanvas(z.x1, z.y1, canvas);
      const b = pctToCanvas(z.x2, z.y2, canvas);
      const w = b.x - a.x, h = b.y - a.y;
      const sel = z === selectedZoneRef.current;
      const isCorridor = (z.label || z.id).toLowerCase().includes('corridor');

      ctx.fillStyle = isCorridor ? 'rgba(74,122,176,0.10)' : z.color + '30';
      ctx.fillRect(a.x, a.y, w, h);

      ctx.strokeStyle = sel ? PALETTE.text : (isCorridor ? PALETTE.waypoint : z.color);
      ctx.lineWidth = sel ? 2.5 : 1.5;
      if (isCorridor) ctx.setLineDash([4, 3]);
      ctx.strokeRect(a.x, a.y, w, h);
      ctx.setLineDash([]);

      ctx.fillStyle = sel ? PALETTE.text : (isCorridor ? PALETTE.waypoint : z.color);
      ctx.font = `bold ${Math.max(10, Math.min(14, w * 0.08))}px ${SANS}`;
      ctx.textBaseline = 'top';
      ctx.fillText((z.label || z.id) + (isCorridor ? ' ⟵' : ''), a.x + 4, a.y + 3);

      if (isCorridor) {
        const cx1 = a.x, cx2 = b.x, cy1 = a.y, cy2 = b.y;
        const midX = (cx1 + cx2) / 2, midY = (cy1 + cy2) / 2;
        ctx.save();
        ctx.strokeStyle = PALETTE.waypoint;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        if (w >= h) {
          ctx.beginPath(); ctx.moveTo(cx1, midY); ctx.lineTo(cx2, midY); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.moveTo(midX, cy1); ctx.lineTo(midX, cy2); ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.restore();
      }
    }

    for (const wp of waypointsRef.current) {
      const p = pctToCanvas(wp.x, wp.y, canvas);
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10, 7, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.waypoint;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 3);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = PALETTE.waypoint;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = `bold 11px ${SANS}`;
      ctx.fillStyle = PALETTE.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const tw = ctx.measureText(wp.name).width + 8;
      ctx.fillStyle = 'rgba(252,250,242,0.88)';
      ctx.fillRect(p.x - tw / 2, p.y + 2, tw, 14);
      ctx.fillStyle = PALETTE.waypoint;
      ctx.fillText(wp.name, p.x, p.y + 3);
      ctx.restore();
    }

    if (pendingWaypointRef.current) {
      const p = pctToCanvas(pendingWaypointRef.current.x, pendingWaypointRef.current.y, canvas);
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 10, 7, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.waypoint;
      ctx.fill();
      ctx.restore();
    }

    if (drawingRef.current && drawStartRef.current?._cur) {
      const s = drawStartRef.current, c = s._cur;
      ctx.strokeStyle = PALETTE.accent;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(s.x, s.y, c.x - s.x, c.y - s.y);
      ctx.setLineDash([]);
    }
  }, []);

  function resizeCanvas() {
    const canvas = canvasRef.current;
    const img    = bgImgRef.current;
    if (!canvas || !img) return;
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.style.width  = img.clientWidth  + 'px';
    canvas.style.height = img.clientHeight + 'px';
    redraw();
  }

  useEffect(() => {
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  async function handleFile(file) {
    const fd = new FormData();
    fd.append('map', file);
    try {
      await fetch('/api/upload-map-image', { method: 'POST', body: fd });
    } catch (err) {
      console.error('Map image upload failed:', err);
    }
    const reader = new FileReader();
    reader.onload = ev => {
      setImageSrc(ev.target.result);
      setZones([]); zonesRef.current = [];
      setWaypoints([]); waypointsRef.current = [];
      setSelectedZone(null); selectedZoneRef.current = null;
      setNextId(1); nextIdRef.current = 1;
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    if (!imageSrc) return;
    const img = bgImgRef.current;
    if (!img) return;
    img.onload = () => { setImageLoaded(true); setTimeout(resizeCanvas, 50); };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) return;

    function onMouseDown(e) {
      const pos = getCanvasPos(e, canvas);
      const t   = toolRef.current;
      if (t === 'draw') {
        drawingRef.current   = true;
        drawStartRef.current = { x: pos.x, y: pos.y, _cur: null };
      } else if (t === 'select') {
        const hit = hitTest(pos, canvas, zonesRef.current);
        selectedZoneRef.current = hit || null;
        setSelectedZone(hit || null);
        if (hit) {
          dragStartRef.current  = pos;
          dragOriginRef.current = { x1: hit.x1, y1: hit.y1, x2: hit.x2, y2: hit.y2 };
          canvas.style.cursor   = 'grabbing';
        }
        redraw();
      } else if (t === 'delete') {
        const hit = hitTest(pos, canvas, zonesRef.current);
        if (hit) {
          const next = zonesRef.current.filter(z => z !== hit);
          zonesRef.current = next; setZones([...next]);
          if (selectedZoneRef.current === hit) { selectedZoneRef.current = null; setSelectedZone(null); }
          redraw();
        } else {
          const pct = canvasToPct(pos.x, pos.y, canvas);
          const hitWp = waypointsRef.current.find(wp => Math.hypot(wp.x - pct.x, wp.y - pct.y) < 3);
          if (hitWp) {
            const next = waypointsRef.current.filter(w => w !== hitWp);
            waypointsRef.current = next; setWaypoints([...next]); redraw();
          }
        }
      } else if (t === 'waypoint') {
        const pct = canvasToPct(pos.x, pos.y, canvas);
        setPendingWaypoint({ x: pct.x, y: pct.y });
        pendingWaypointRef.current = { x: pct.x, y: pct.y };
        setWaypointName('');
        redraw();
        setTimeout(() => waypointInputRef.current?.focus(), 50);
      }
    }

    function onMouseMove(e) {
      const pos = getCanvasPos(e, canvas);
      if (toolRef.current === 'draw' && drawingRef.current && drawStartRef.current) {
        drawStartRef.current._cur = pos; redraw();
      } else if (toolRef.current === 'select' && dragStartRef.current && selectedZoneRef.current) {
        const dx = canvasToPct(pos.x - dragStartRef.current.x, 0, canvas).x;
        const dy = canvasToPct(0, pos.y - dragStartRef.current.y, canvas).y;
        const z  = selectedZoneRef.current;
        z.x1 = dragOriginRef.current.x1 + dx; z.y1 = dragOriginRef.current.y1 + dy;
        z.x2 = dragOriginRef.current.x2 + dx; z.y2 = dragOriginRef.current.y2 + dy;
        redraw();
      }
    }

    function onMouseUp(e) {
      const pos  = getCanvasPos(e, canvas);
      const step = gridStepRef.current;
      if (toolRef.current === 'draw' && drawingRef.current && drawStartRef.current) {
        drawingRef.current = false;
        const p0 = canvasToPct(drawStartRef.current.x, drawStartRef.current.y, canvas);
        const p1 = canvasToPct(pos.x, pos.y, canvas);
        const x1 = snapPct(Math.min(p0.x, p1.x), step), y1 = snapPct(Math.min(p0.y, p1.y), step);
        const x2 = snapPct(Math.max(p0.x, p1.x), step), y2 = snapPct(Math.max(p0.y, p1.y), step);
        if (Math.abs(x2 - x1) >= step && Math.abs(y2 - y1) >= step) {
          const id = 'zone' + nextIdRef.current;
          nextIdRef.current++; setNextId(nextIdRef.current);
          const z = { id, x1, y1, x2, y2, color: ZONE_COLORS[zonesRef.current.length % ZONE_COLORS.length], label: id };
          const next = [...zonesRef.current, z];
          zonesRef.current = next; setZones([...next]);
          selectedZoneRef.current = z; setSelectedZone(z);
        }
        drawStartRef.current = null; redraw();
      } else if (toolRef.current === 'select') {
        dragStartRef.current = null; dragOriginRef.current = null;
        canvas.style.cursor = 'default';
        if (selectedZoneRef.current) {
          const z = selectedZoneRef.current;
          z.x1 = snapPct(z.x1, step); z.y1 = snapPct(z.y1, step);
          z.x2 = snapPct(z.x2, step); z.y2 = snapPct(z.y2, step);
          setZones([...zonesRef.current]);
        }
        redraw();
      }
    }

    function onMouseLeave() {
      if (drawingRef.current) { drawingRef.current = false; drawStartRef.current = null; redraw(); }
      if (dragStartRef.current) { dragStartRef.current = null; canvas.style.cursor = 'default'; }
    }

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup',   onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup',   onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [imageLoaded, redraw]);

  useEffect(() => { redraw(); }, [showGrid, redraw]);

  function confirmWaypoint() {
    if (!pendingWaypoint || !waypointName.trim()) return;
    const wp = { id: 'wp_' + Date.now(), name: waypointName.trim(), x: pendingWaypoint.x, y: pendingWaypoint.y };
    const next = [...waypointsRef.current, wp];
    waypointsRef.current = next; setWaypoints([...next]);
    setPendingWaypoint(null); pendingWaypointRef.current = null;
    setWaypointName(''); redraw();
  }

  function cancelWaypoint() {
    setPendingWaypoint(null); pendingWaypointRef.current = null;
    setWaypointName(''); redraw();
  }

  function deleteWaypoint(id) {
    const next = waypointsRef.current.filter(w => w.id !== id);
    waypointsRef.current = next; setWaypoints([...next]); redraw();
  }

  function onDragOver(e) { e.preventDefault(); }
  function onDrop(e) { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }

  function setTool(t) {
    setToolState(t);
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor =
      t === 'draw' ? 'crosshair' : t === 'delete' ? 'not-allowed' : t === 'waypoint' ? 'cell' : 'default';
  }

  function renameZone(id, label) {
    const next = zonesRef.current.map(z => z.id === id ? { ...z, label } : z);
    zonesRef.current = next; setZones([...next]); redraw();
  }
  function deleteZone(id) {
    const next = zonesRef.current.filter(z => z.id !== id);
    zonesRef.current = next; setZones([...next]);
    if (selectedZoneRef.current?.id === id) { selectedZoneRef.current = null; setSelectedZone(null); }
    redraw();
  }

  // ─────────────────────────────────────────────────────────
  // GENERATE — fixed corridor pathfinding
  // ─────────────────────────────────────────────────────────
  async function generate() {
    const step = gridStep;

    const zoneData = zones.map(z => ({
      id:   z.label || z.id,
      x1:   Math.round(z.x1 * 10) / 10,
      y1:   Math.round(z.y1 * 10) / 10,
      x2:   Math.round(z.x2 * 10) / 10,
      y2:   Math.round(z.y2 * 10) / 10,
      type: (z.label || z.id).toLowerCase().includes('corridor') ? 'Corridor' : 'Location'
    }));

    // ── connection detection (unchanged) ──
    const connections = [];
    for (let i = 0; i < zoneData.length; i++) {
      for (let j = i + 1; j < zoneData.length; j++) {
        const a = zoneData[i], b = zoneData[j];
        const xGap = Math.max(a.x1, b.x1) - Math.min(a.x2, b.x2);
        const yGap = Math.max(a.y1, b.y1) - Math.min(a.y2, b.y2);
        if (xGap <= step * 2 && yGap <= step * 2) connections.push([a.id, b.id]);
      }
    }

    const nodeMap   = new Map(); // key → node
    const zoneNodes = new Map(); // zoneId → Set<key>

    function key(x, y) { return `${Math.round(x * 100)},${Math.round(y * 100)}`; }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function addEdge(a, b) {
      if (a.id === b.id) return;
      if (!a.neighbors.includes(b.id)) a.neighbors.push(b.id);
      if (!b.neighbors.includes(a.id)) b.neighbors.push(a.id);
    }
    function gridPositions(min, max) {
      const positions = [];
      const start = Math.ceil(min / step) * step;
      for (let p = start; p <= max + 1e-9; p += step)
        positions.push(Math.round(p * 1000) / 1000);
      return positions;
    }

    // ── PHASE 1: node creation ──
    // Rooms  → full grid of nodes inside bbox.
    // Corridors → spine-only nodes along the centre axis.
    for (const zone of zoneData) {
      const xs   = gridPositions(zone.x1, zone.x2);
      const ys   = gridPositions(zone.y1, zone.y2);
      const keys = new Set();

      if (zone.type === 'Corridor') {
        const w = zone.x2 - zone.x1, h = zone.y2 - zone.y1;
        if (w >= h) {
          // horizontal corridor — spine runs at vertical centre
          const midY = Math.round(((zone.y1 + zone.y2) / 2) * 1000) / 1000;
          for (const x of xs) {
            const k = key(x, midY);
            if (!nodeMap.has(k)) nodeMap.set(k, { id: k, x, y: midY, neighbors: [] });
            keys.add(k);
          }
        } else {
          // vertical corridor — spine runs at horizontal centre
          const midX = Math.round(((zone.x1 + zone.x2) / 2) * 1000) / 1000;
          for (const y of ys) {
            const k = key(midX, y);
            if (!nodeMap.has(k)) nodeMap.set(k, { id: k, x: midX, y, neighbors: [] });
            keys.add(k);
          }
        }
      } else {
        for (const x of xs) {
          for (const y of ys) {
            const k = key(x, y);
            if (!nodeMap.has(k)) nodeMap.set(k, { id: k, x, y, neighbors: [] });
            keys.add(k);
          }
        }
      }
      zoneNodes.set(zone.id, keys);
    }

    // ── PHASE 2: internal edges ──
    for (const zone of zoneData) {
      const xs = gridPositions(zone.x1, zone.x2);
      const ys = gridPositions(zone.y1, zone.y2);

      if (zone.type === 'Corridor') {
        // chain spine nodes in order
        const w = zone.x2 - zone.x1, h = zone.y2 - zone.y1;
        const spine = [...zoneNodes.get(zone.id)]
          .map(k => nodeMap.get(k))
          .sort((a, b) => w >= h ? a.x - b.x : a.y - b.y);
        for (let i = 0; i < spine.length - 1; i++) addEdge(spine[i], spine[i + 1]);
      } else {
        for (const x of xs) {
          for (const y of ys) {
            const n  = nodeMap.get(key(x, y));
            if (!n) continue;
            const kr = key(x + step, y), kd = key(x, y + step);
            if (nodeMap.has(kr) && zoneNodes.get(zone.id).has(kr)) addEdge(n, nodeMap.get(kr));
            if (nodeMap.has(kd) && zoneNodes.get(zone.id).has(kd)) addEdge(n, nodeMap.get(kd));
          }
        }
      }
    }

    // ── PHASE 3: cross-zone boundary edges (FIXED) ──
    //
    // Strategy per pair type:
    //
    // Room ↔ Room
    //   Collect nodes that lie exactly on or very close to the shared
    //   boundary segment, from both zones.  Connect pairs that are within
    //   step distance of each other.  (original logic, slightly relaxed)
    //
    // Corridor ↔ Room  (or Room ↔ Corridor)
    //   The spine does NOT touch the room boundary — its nodes float at
    //   the corridor's centre axis.  We find every spine node whose
    //   perpendicular distance to the shared boundary ≤ step*1.5, and for
    //   each such node we find the closest room-side boundary node and
    //   connect them.  This bridges the full length of the interface, not
    //   just the two endpoints.
    //
    // Corridor ↔ Corridor
    //   Find the closest pair of spine nodes (one from each corridor) and
    //   connect them, then do the same for the second-closest pair on the
    //   other end of the interface so both ends are linked.

    for (const [zA, zB] of connections) {
      const zoneA = zoneData.find(z => z.id === zA);
      const zoneB = zoneData.find(z => z.id === zB);
      const keysA = zoneNodes.get(zA);
      const keysB = zoneNodes.get(zB);
      if (!keysA || !keysB || !zoneA || !zoneB) continue;

      const nodesA = [...keysA].map(k => nodeMap.get(k)).filter(Boolean);
      const nodesB = [...keysB].map(k => nodeMap.get(k)).filter(Boolean);
      if (!nodesA.length || !nodesB.length) continue;

      const isCorrA = zoneA.type === 'Corridor';
      const isCorrB = zoneB.type === 'Corridor';

      // Shared boundary interval in both axes
      const sharedX1 = Math.max(zoneA.x1, zoneB.x1);
      const sharedX2 = Math.min(zoneA.x2, zoneB.x2);
      const sharedY1 = Math.max(zoneA.y1, zoneB.y1);
      const sharedY2 = Math.min(zoneA.y2, zoneB.y2);

      // Is this a horizontal or vertical interface?
      const isHInterface = (sharedX2 - sharedX1) > (sharedY2 - sharedY1);

      if (!isCorrA && !isCorrB) {
        // ── Room ↔ Room ──────────────────────────────────────────────
        // Collect nodes from each zone that sit on the shared boundary,
        // then link pairs that are within step distance.
        const SNAP = step * 0.1;

        const boundaryA = nodesA.filter(n => {
          if (isHInterface) return Math.abs(n.y - sharedY1) < SNAP || Math.abs(n.y - sharedY2) < SNAP;
          else               return Math.abs(n.x - sharedX1) < SNAP || Math.abs(n.x - sharedX2) < SNAP;
        });
        const boundaryB = nodesB.filter(n => {
          if (isHInterface) return Math.abs(n.y - sharedY1) < SNAP || Math.abs(n.y - sharedY2) < SNAP;
          else               return Math.abs(n.x - sharedX1) < SNAP || Math.abs(n.x - sharedX2) < SNAP;
        });

        // For every boundary-A node find the closest boundary-B node
        // within step*1.5 and connect them.
        for (const na of boundaryA) {
          let best = null, bestD = step * 1.5;
          for (const nb of boundaryB) {
            const d = dist(na, nb);
            if (d < bestD) { bestD = d; best = nb; }
          }
          if (best) addEdge(na, best);
        }

      } else if (isCorrA && isCorrB) {
        // ── Corridor ↔ Corridor ──────────────────────────────────────
        // Find ALL pairs (one spine node from each corridor) sorted by
        // distance. Connect the closest pair, then connect the closest
        // pair that is spatially separated enough to represent the OTHER
        // end of the interface (avoids just connecting the same node twice).
        const pairs = [];
        for (const na of nodesA)
          for (const nb of nodesB)
            pairs.push({ na, nb, d: dist(na, nb) });
        pairs.sort((a, b) => a.d - b.d);

        if (pairs.length === 0) continue;
        addEdge(pairs[0].na, pairs[0].nb);

        // Find a second pair where at least one node differs significantly
        // — this handles T- and L-junctions between two corridors.
        const minSep = step * 1.5;
        for (const p of pairs.slice(1)) {
          if (dist(p.na, pairs[0].na) > minSep || dist(p.nb, pairs[0].nb) > minSep) {
            addEdge(p.na, p.nb);
            break;
          }
        }

 // Replace the Corridor ↔ Room block (lines 598–637) with:

} else {
  // ── Corridor ↔ Room ──────────────────────────────────────────
  const [corrNodes, roomNodes] = isCorrA
    ? [nodesA, nodesB]
    : [nodesB, nodesA];

  // Pick whichever corridor spine nodes are closest to any room node
  // — don't assume which side of the corridor faces the room.
  const sorted = [...corrNodes].sort((a, b) => {
    const dA = Math.min(...roomNodes.map(r => dist(a, r)));
    const dB = Math.min(...roomNodes.map(r => dist(b, r)));
    return dA - dB;
  });
  const bridgeSpine = sorted.slice(0, 2);

  for (const sn of bridgeSpine) {
    let best = null, bestD = step * 4.0;
    for (const rn of roomNodes) {
      const d = dist(sn, rn);
      if (d < bestD) { bestD = d; best = rn; }
    }
    if (best) addEdge(sn, best);
  }
}
    }
    // ── PHASE 4: build output arrays ──
    const NAV_NODES = [...nodeMap.values()];

    function nearestNodeInZone(x, y, zoneId) {
      const zone       = zoneData.find(z => z.id === zoneId);
      const candidates = zone
        ? NAV_NODES.filter(n =>
            n.x >= zone.x1 - step && n.x <= zone.x2 + step &&
            n.y >= zone.y1 - step && n.y <= zone.y2 + step)
        : NAV_NODES;
      if (!candidates.length) return null;
      return candidates.reduce((best, n) =>
        dist(n, { x, y }) < dist(best, { x, y }) ? n : best
      ).id;
    }

    const zoneLocs = zoneData.map(z => {
      const cx = Math.round(((z.x1 + z.x2) / 2) * 10) / 10;
      const cy = Math.round(((z.y1 + z.y2) / 2) * 10) / 10;
      return { id: z.id, label: z.id, name: z.id, type: z.type, navNode: nearestNodeInZone(cx, cy, z.id), center: { x: cx, y: cy } };
    });

    const wpLocs = waypoints.map(wp => {
      const nearestId = NAV_NODES.length
        ? NAV_NODES.reduce((best, n) =>
            Math.hypot(n.x - wp.x, n.y - wp.y) < Math.hypot(best.x - wp.x, best.y - wp.y) ? n : best
          ).id
        : null;
      return { id: wp.id, label: wp.name, name: wp.name, type: 'Waypoint', navNode: nearestId, center: { x: Math.round(wp.x * 10) / 10, y: Math.round(wp.y * 10) / 10 } };
    });

    const LOCATIONS = [...zoneLocs, ...wpLocs];

    const ZONE_NODE_KEYS_OBJ = Object.fromEntries(
      [...zoneNodes.entries()].map(([id, keySet]) => [id, [...keySet]])
    );

    const mapData = {
      GRID_STEP: step,
      ZONE_RECTS: zoneData,
      ZONE_CONNECTIONS: connections,
      NAV_NODES,
      LOCATIONS,
      ZONE_NODE_KEYS: ZONE_NODE_KEYS_OBJ
    };

    try {
      await fetch('/api/save-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mapData)
      });
      setStatus({ msg: `✓ Saved — ${connections.length} connections, ${NAV_NODES.length} nodes, ${LOCATIONS.length} locations.`, type: 'success' });
    } catch {
      setStatus({ msg: 'Failed to save map.', type: 'error' });
    }

    setGeneratedCode(JSON.stringify(mapData, null, 2));
    setShowOutput(true);
  }

  function copyOutput() {
    navigator.clipboard.writeText(generatedCode).then(() => {
      setStatus({ msg: '✓ Copied to clipboard!', type: 'success' });
      setTimeout(() => setStatus({ msg: '✓ Done — ready to use.', type: 'success' }), 2000);
    });
  }
  function downloadOutput() {
    const blob = new Blob([generatedCode], { type: 'text/javascript' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mapData.js'; a.click();
  }

  const canGenerate = zones.length > 0 && imageLoaded;
  const hintText = {
    draw:     'Click & drag to draw a zone rectangle',
    select:   'Click a zone to select · drag to reposition',
    delete:   'Click a zone or waypoint to delete it',
    waypoint: 'Click anywhere to place a named waypoint',
  }[tool];

  const sectionTitle = {
    fontSize: '0.62rem', letterSpacing: '0.22em', textTransform: 'uppercase',
    color: PALETTE.accent, marginBottom: 14, fontWeight: 600, fontFamily: SANS
  };
  const panelBorder = `1px solid ${PALETTE.border}`;

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: PALETTE.bg, color: PALETTE.text, fontFamily: SANS
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', flex: 1, minWidth: 0 }}>

        {/* ── CANVAS ── */}
        <div onDragOver={onDragOver} onDrop={onDrop} style={{
          position: 'relative', overflow: 'hidden', background: PALETTE.canvasBg,
          backgroundImage: `radial-gradient(${PALETTE.borderSoft} 1px, transparent 1px)`,
          backgroundSize: '20px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {!imageLoaded && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, color: PALETTE.textMuted, fontSize: '0.88rem', fontFamily: SERIF }}>
              <svg width="56" height="56" viewBox="0 0 48 48" fill="none">
                <rect x="6" y="10" width="36" height="28" rx="3" stroke={PALETTE.accent} strokeWidth="1.5" opacity="0.5"/>
                <path d="M16 24h16M24 16v16" stroke={PALETTE.accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
              </svg>
              <span style={{ fontStyle: 'italic' }}>Upload a floor plan to begin</span>
            </div>
          )}
          <div ref={canvasWrapRef} style={{
            position: 'relative', display: imageLoaded ? 'inline-block' : 'none',
            boxShadow: '0 8px 30px rgba(80,55,20,0.12)', borderRadius: 6, overflow: 'hidden',
          }}>
            <img ref={bgImgRef} alt="floor plan"
              style={{ display: 'block', maxWidth: '100%', maxHeight: 'calc(100vh - 60px)', userSelect: 'none', pointerEvents: 'none' }} />
            <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
          </div>

          {pendingWaypoint && (
            <div style={{
              position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
              background: PALETTE.panel, border: `1.5px solid ${PALETTE.waypoint}`,
              borderRadius: 10, padding: '12px 16px', boxShadow: '0 4px 20px rgba(74,122,176,0.2)',
              display: 'flex', gap: 8, alignItems: 'center', zIndex: 10,
            }}>
              <span style={{ fontSize: '0.75rem', color: PALETTE.waypoint, fontWeight: 600, whiteSpace: 'nowrap' }}>📍 Name:</span>
              <input ref={waypointInputRef} value={waypointName}
                onChange={e => setWaypointName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') confirmWaypoint(); if (e.key === 'Escape') cancelWaypoint(); }}
                placeholder="Waypoint name…"
                style={{ background: PALETTE.panelAlt, border: `1px solid ${PALETTE.border}`, borderRadius: 6, padding: '6px 10px', fontFamily: SANS, fontSize: '0.78rem', color: PALETTE.text, outline: 'none', width: 160 }} />
              <button onClick={confirmWaypoint} style={{ background: PALETTE.waypoint, color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>Add</button>
              <button onClick={cancelWaypoint} style={{ background: 'transparent', color: PALETTE.textMuted, border: `1px solid ${PALETTE.border}`, borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
            </div>
          )}

          {imageLoaded && (
            <div style={{
              position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
              background: PALETTE.panel, border: `1px solid ${PALETTE.border}`, borderRadius: 999,
              padding: '7px 16px', fontSize: '0.7rem', color: PALETTE.textMuted,
              whiteSpace: 'nowrap', pointerEvents: 'none', boxShadow: '0 2px 10px rgba(80,55,20,0.08)',
            }}>{hintText}</div>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{ borderLeft: panelBorder, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: PALETTE.panel }}>
          <div style={{ padding: '22px 20px 14px', borderBottom: panelBorder }}>
            <div style={{ fontFamily: SERIF, fontSize: '1.5rem', color: PALETTE.text, letterSpacing: '0.01em', lineHeight: 1.1 }}>Map Generator</div>
            <div style={{ fontSize: '0.66rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: PALETTE.textMuted, marginTop: 6 }}>Floor Plan · Atelier</div>
          </div>

          <div style={{ padding: '18px 20px', borderBottom: panelBorder }}>
            <div style={sectionTitle}>01 · Image</div>
            <div onClick={() => fileInputRef.current?.click()} style={{
              border: `1.5px dashed ${PALETTE.border}`, borderRadius: 10, padding: '22px 14px',
              textAlign: 'center', cursor: 'pointer', color: PALETTE.textMuted, fontSize: '0.78rem',
              lineHeight: 1.7, background: PALETTE.panelAlt + '55', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = PALETTE.accent; e.currentTarget.style.color = PALETTE.accent; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = PALETTE.border; e.currentTarget.style.color = PALETTE.textMuted; }}>
              {imageSrc ? '✓ Image loaded — click to replace' : 'Drop floor plan here\nor click to browse'}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
          </div>

          {imageLoaded && (
            <div style={{ padding: '18px 20px', borderBottom: panelBorder }}>
              <div style={sectionTitle}>02 · Tools</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                {[
                  { t: 'draw', icon: '✦', label: 'Draw' },
                  { t: 'select', icon: '↖', label: 'Select' },
                  { t: 'delete', icon: '✕', label: 'Delete' },
                  { t: 'waypoint', icon: '📍', label: 'Waypoint' },
                ].map(({ t, icon, label }) => (
                  <button key={t} onClick={() => setTool(t)} style={{
                    padding: '8px 4px', borderRadius: 8, fontSize: '0.72rem', cursor: 'pointer',
                    border: `1px solid ${tool === t ? (t === 'waypoint' ? PALETTE.waypoint : PALETTE.accent) : PALETTE.border}`,
                    background: tool === t ? (t === 'waypoint' ? PALETTE.waypointBg : PALETTE.accentBg) : PALETTE.panel,
                    color: tool === t ? (t === 'waypoint' ? PALETTE.waypoint : PALETTE.accent) : PALETTE.textMuted,
                    fontWeight: tool === t ? 600 : 500, transition: 'all 0.15s', fontFamily: SANS,
                  }}>{icon} {label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.72rem', color: PALETTE.textMuted }}>
                  <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} style={{ accentColor: PALETTE.accent }} />
                  Grid overlay
                </label>
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: '0.62rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: PALETTE.textMuted, display: 'block', marginBottom: 6 }}>Grid step (snap)</label>
                <input type="number" value={gridStep} min="0.5" max="10" step="0.5"
                  onChange={e => { setGridStep(parseFloat(e.target.value) || 1); setTimeout(redraw, 0); }}
                  style={{ width: '100%', background: PALETTE.panel, border: `1px solid ${PALETTE.border}`, color: PALETTE.text, padding: '8px 10px', borderRadius: 6, fontFamily: SANS, fontSize: '0.78rem', outline: 'none' }}
                  onFocus={e => e.currentTarget.style.borderColor = PALETTE.accent}
                  onBlur={e => e.currentTarget.style.borderColor = PALETTE.border} />
              </div>
              <div style={{ fontSize: '0.7rem', color: PALETTE.textMuted, lineHeight: 1.6, fontStyle: 'italic' }}>{hintText}</div>
              <div style={{ fontSize: '0.66rem', color: PALETTE.accentSoft, marginTop: 6, lineHeight: 1.5 }}>
                Tip: name a zone "corridor" to generate a spine-only nav line
              </div>
            </div>
          )}

          <div style={{ padding: '18px 20px', flex: 1, overflowY: 'auto', borderBottom: panelBorder }}>
            <div style={sectionTitle}>Zones <span style={{ color: PALETTE.textMuted, fontWeight: 400 }}>({zones.length})</span></div>
            {zones.length === 0
              ? <div style={{ fontSize: '0.76rem', color: PALETTE.textMuted, textAlign: 'center', padding: '16px 0', lineHeight: 1.8, fontStyle: 'italic' }}>Upload an image<br />then draw zones</div>
              : zones.map(z => {
                const isCorridor = (z.label || z.id).toLowerCase().includes('corridor');
                return (
                  <div key={z.id} onClick={() => { setSelectedZone(z); selectedZoneRef.current = z; redraw(); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 6, borderRadius: 8, border: `1px solid ${selectedZone === z ? PALETTE.accent : PALETTE.border}`, background: selectedZone === z ? PALETTE.accentBg : PALETTE.panelAlt + '70', cursor: 'pointer', fontSize: '0.76rem' }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: isCorridor ? PALETTE.waypoint : z.color, flexShrink: 0 }} />
                    <input defaultValue={z.label} onClick={e => e.stopPropagation()}
                      onBlur={e => renameZone(z.id, e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                      style={{ flex: 1, background: 'transparent', border: 'none', color: PALETTE.text, fontFamily: SANS, fontSize: '0.78rem', outline: 'none' }} />
                    {isCorridor && <span style={{ fontSize: '0.6rem', color: PALETTE.waypoint, background: PALETTE.waypointBg, padding: '1px 5px', borderRadius: 4 }}>spine</span>}
                    <span onClick={e => { e.stopPropagation(); deleteZone(z.id); }}
                      style={{ color: PALETTE.textMuted, cursor: 'pointer', fontSize: '0.85rem', padding: '0 4px' }}
                      onMouseEnter={e => e.currentTarget.style.color = PALETTE.danger}
                      onMouseLeave={e => e.currentTarget.style.color = PALETTE.textMuted}>✕</span>
                  </div>
                );
              })
            }

            {waypoints.length > 0 && (
              <>
                <div style={{ ...sectionTitle, marginTop: 16 }}>Waypoints <span style={{ color: PALETTE.textMuted, fontWeight: 400 }}>({waypoints.length})</span></div>
                {waypoints.map(wp => (
                  <div key={wp.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 6, borderRadius: 8, border: `1px solid ${PALETTE.border}`, background: PALETTE.waypointBg, fontSize: '0.76rem' }}>
                    <span style={{ fontSize: '0.85rem' }}>📍</span>
                    <span style={{ flex: 1, color: PALETTE.text }}>{wp.name}</span>
                    <span style={{ fontSize: '0.6rem', color: PALETTE.textMuted }}>{Math.round(wp.x * 10) / 10}, {Math.round(wp.y * 10) / 10}</span>
                    <span onClick={() => deleteWaypoint(wp.id)}
                      style={{ color: PALETTE.textMuted, cursor: 'pointer', fontSize: '0.85rem', padding: '0 4px' }}
                      onMouseEnter={e => e.currentTarget.style.color = PALETTE.danger}
                      onMouseLeave={e => e.currentTarget.style.color = PALETTE.textMuted}>✕</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {status.msg !== 'Ready' && (
            <div style={{ padding: '8px 20px', fontSize: '0.7rem', borderBottom: panelBorder,
              color: status.type === 'success' ? PALETTE.success : status.type === 'error' ? PALETTE.danger : PALETTE.textMuted }}>
              {status.msg}
            </div>
          )}

          {showOutput && (
            <div style={{ padding: '14px 20px', borderBottom: panelBorder }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={copyOutput} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', border: `1px solid ${PALETTE.border}`, background: PALETTE.panelAlt, color: PALETTE.text, fontFamily: SANS }}>⎘ Copy</button>
                <button onClick={downloadOutput} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', border: `1px solid ${PALETTE.border}`, background: PALETTE.panelAlt, color: PALETTE.text, fontFamily: SANS }}>↓ Download</button>
              </div>
            </div>
          )}

          <div style={{ padding: '18px 20px' }}>
            <div style={sectionTitle}>03 · Export</div>
            <button onClick={generate} disabled={!canGenerate} style={{
              width: '100%', padding: '12px', borderRadius: 999, fontFamily: SANS,
              fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.04em',
              cursor: canGenerate ? 'pointer' : 'not-allowed', border: 'none',
              background: canGenerate ? PALETTE.accent : PALETTE.border,
              color: canGenerate ? '#fff8e8' : PALETTE.textMuted,
              boxShadow: canGenerate ? '0 2px 12px rgba(184,122,26,0.25)' : 'none',
              transition: 'all 0.15s',
            }}>Generate mapData.js ↗</button>
          </div>
        </div>
      </div>
    </div>
  );
}