/**
 * speak.js  —  MUSE voice output
 *
 * Replaces the old browser SpeechSynthesis approach.
 * All TTS is now handled server-side by Piper, running on the laptop.
 * The Pi (or any client on the network) calls /api/tts and plays the WAV.
 *
 * Falls back to browser SpeechSynthesis if the server TTS endpoint fails,
 * so the app still works when the server is unavailable.
 */

let currentAudio = null;

/**
 * Speak text via Piper TTS (server-side).
 * @param {string} text
 * @param {string} [lang]  — kept for API compatibility; Piper uses a fixed voice
 */
export async function speak(text, lang = 'en-GB') {
  if (!text) return;

  // Stop anything currently playing
  stopSpeaking();

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: lang?.split('-')[0] || 'en' }),
    });

    if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);

    currentAudio = new Audio(url);
    currentAudio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
    };

    await currentAudio.play();
  } catch (err) {
    console.warn('[MUSE TTS] Piper unavailable, falling back to browser voice:', err.message);
    _browserFallback(text, lang);
  }
}

/**
 * Stop any currently playing TTS audio.
 */
export function stopSpeaking() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  // Also cancel any in-flight browser fallback
  if (typeof speechSynthesis !== 'undefined') {
    speechSynthesis.cancel();
  }
}

// ─── Browser fallback (used when /api/tts is unreachable) ────────────────────

function _browserFallback(text, lang) {
  if (typeof speechSynthesis === 'undefined') return;

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang   = lang || 'en-GB';
  utter.rate   = 0.95;
  utter.pitch  = 1;
  utter.volume = 1;

  const voices = speechSynthesis.getVoices();
  if (voices.length) {
    const preferred = ['Google UK English Female', 'Microsoft Hazel', 'Microsoft Libby', 'Serena'];
    const pick =
      preferred.map(n => voices.find(v => v.name.includes(n))).find(Boolean) ||
      voices.find(v => v.lang === 'en-GB') ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0];
    if (pick) { utter.voice = pick; utter.lang = pick.lang; }
  }

  speechSynthesis.speak(utter);
}