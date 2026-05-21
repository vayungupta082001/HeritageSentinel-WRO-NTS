/**
 * useVoiceWS.js  —  React hook
 *
 * Manages a single, auto-reconnecting WebSocket used exclusively for the
 * voice pipeline (audio upload → Whisper → AI reply).
 *
 * This is separate from the existing socket.io connection (socket.js) so
 * the binary audio frames and the JSON control traffic don't collide.
 *
 * Usage:
 *   const { ws, wsReady } = useVoiceWS();
 */

import { useState, useEffect, useRef } from 'react';

function getVoiceWsUrl() {
  const { hostname, port, protocol } = window.location;
  const p = port || (protocol === 'https:' ? '443' : '80');
  // Use ws:// always — Piper/Whisper are local, no TLS needed
  return `ws://${hostname}:${p}/voice`;
}

export function useVoiceWS() {
  const [wsReady, setWsReady] = useState(false);
  const wsRef    = useRef(null);

  useEffect(() => {
    let cancelled = false;

    function connect() {
      if (cancelled) return;

      const ws = new WebSocket(getVoiceWsUrl());
      wsRef.current = ws;

      ws.onopen  = () => setWsReady(true);
      ws.onclose = () => {
        setWsReady(false);
        if (!cancelled) setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      cancelled = true;
      wsRef.current?.close();
    };
  }, []);

  return { ws: wsRef.current, wsReady, wsRef };
}