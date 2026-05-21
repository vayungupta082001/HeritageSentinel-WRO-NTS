/**
 * speechRecognition.js  —  MUSE voice input
 *
 * Replaces the old Web Speech API (window.SpeechRecognition) approach.
 *
 * New pipeline:
 *   1. Capture mic audio via MediaRecorder (webm/opus)
 *   2. Stream binary blob to the laptop server over the existing WebSocket
 *   3. Server pipes audio through ffmpeg → Whisper → Gemma/MUSE LLM
 *   4. Server sends back { type: "voiceTranscript", user, text }
 *   5. onResult(text) is called with the AI reply; onUserText(raw) with the
 *      raw Whisper transcript so the UI can display "You asked: …"
 */

// ─── CHANGE THIS to your preferred device label or set to null to auto-pick ───
const PREFERRED_MIC_LABEL = 'USB PnP Sound Device'; // matches your hw:3,0 device
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Resolves the deviceId of the preferred mic by matching label.
 * Falls back to default if not found.
 */
async function resolveAudioDeviceId(preferredLabel) {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter((d) => d.kind === 'audioinput');

    console.log('[Voice] Available audio input devices:');
    audioInputs.forEach((d) => console.log(`  - ${d.label} (${d.deviceId})`));

    if (preferredLabel) {
      const match = audioInputs.find((d) =>
        d.label.toLowerCase().includes(preferredLabel.toLowerCase())
      );
      if (match) {
        console.log(`[Voice] Using preferred mic: ${match.label}`);
        return match.deviceId;
      }
      console.warn(`[Voice] Preferred mic "${preferredLabel}" not found, using default.`);
    }

    return null; // null = browser default
  } catch (err) {
    console.warn('[Voice] Could not enumerate devices:', err.message);
    return null;
  }
}

/**
 * Start a push-to-talk voice session over the shared WebSocket.
 *
 * @param {object}    opts
 * @param {string}    opts.lang          — kept for API compat; Whisper auto-detects
 * @param {WebSocket} opts.ws            — the open WebSocket from useVoiceWS hook
 * @param {function}  opts.onResult      — called with the AI text reply
 * @param {function}  [opts.onUserText]  — called with the raw user transcript
 * @param {function}  [opts.onError]     — called on mic/WS errors
 * @param {function}  [opts.onStop]      — called when recording stops (before reply)
 * @param {string}    [opts.deviceId]    — optional: override mic deviceId directly
 *
 * @returns {{ stop: function }}  — call stop() to end the recording and send audio
 */
export function startVoiceRecognition({ lang, ws, onResult, onUserText, onError, onStop, deviceId }) {
  // Guard: need an open WebSocket
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    onError?.(new Error('Voice WebSocket not connected.'));
    return { stop: () => {} };
  }

  let mediaRecorder = null;
  const chunks = [];

  // Resolve device then start recording
  resolveAudioDeviceId(deviceId ? null : PREFERRED_MIC_LABEL).then((resolvedDeviceId) => {
    const audioConstraints = resolvedDeviceId || deviceId
      ? { deviceId: { exact: resolvedDeviceId || deviceId } }
      : true;

    return navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
  })
    .then((stream) => {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

 // In mediaRecorder.onstop, replace the blob.arrayBuffer block:
mediaRecorder.onstop = () => {
  stream.getTracks().forEach((t) => t.stop());
  onStop?.();

  const blob = new Blob(chunks, { type: 'audio/webm' });
  blob.arrayBuffer().then((buf) => {
    if (ws.readyState === WebSocket.OPEN) {
      // Send language as a JSON frame first, then the audio binary
      ws.send(JSON.stringify({ type: 'voiceMeta', lang }));
      ws.send(buf);
    } else {
      onError?.(new Error('WebSocket closed before audio could be sent.'));
    }
  });
};

      mediaRecorder.start();
      console.log('[Voice] Recording started.');
    })
    .catch((err) => {
      onError?.(new Error(`Mic error: ${err.message}`));
    });

  return {
    stop() {
      if (mediaRecorder?.state === 'recording') {
        mediaRecorder.stop();
        console.log('[Voice] Recording stopped.');
      }
    },
  };
}

/**
 * Attach a one-time voiceTranscript handler to the WebSocket.
 * Call this before startVoiceRecognition so the callback is wired up.
 *
 * Returns a cleanup function — call it to detach the listener.
 */
export function onVoiceReply(ws, { onResult, onUserText, onError }) {
  if (!ws) return () => {};

  function handler(event) {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'voiceTranscript') {
        onUserText?.(msg.user);
        onResult?.(msg.text);
      } else if (msg.type === 'voiceError') {
        onError?.(new Error(msg.message));
      }
    } catch {
      // non-JSON frame (e.g. existing museReply frames) — ignore
    }
  }

  ws.addEventListener('message', handler);
  return () => ws.removeEventListener('message', handler);
}

/**
 * Utility: list all available audio input devices.
 * Call from browser console to find your device label/ID.
 *
 * Usage: import { listMicDevices } from './speechRecognition';
 *        listMicDevices().then(console.table);
 */
export async function listMicDevices() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === 'audioinput')
    .map((d) => ({ label: d.label, deviceId: d.deviceId }));
}