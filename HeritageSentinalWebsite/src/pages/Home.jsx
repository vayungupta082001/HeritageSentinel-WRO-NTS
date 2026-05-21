import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import socket from '../socket';
import { t } from '../utils/translations';
import { speak } from '../utils/speak';
import { getNextLanguage, languageChangedMessage } from '../utils/language';
import { startVoiceRecognition, onVoiceReply } from '../utils/speechRecognition';
import { typeText } from '../utils/typingEffect';
import { askMuse as askMuseApi } from '../utils/api';
import { stopSpeaking } from '../utils/speak';
import { useVoiceWS } from '../utils/useVoiceWS.js';

// useBots and useArtifacts are stable — no composite index required
import { useBots, useArtifacts } from '../hooks/useFirestore';

function IconRobot({ className, title = 'Fleet' }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : 'presentation'}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M12 2.5c1.1 0 2 .9 2 2v1h1.1c3.1 0 4.9 1.8 4.9 4.9v4.1c0 3.1-1.8 4.9-4.9 4.9H8.9C5.8 19.4 4 17.6 4 14.5V10.4c0-3.1 1.8-4.9 4.9-4.9H10V4.5c0-1.1.9-2 2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9 12.3h.01M15 12.3h.01"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M9.2 15.5c.8.9 1.8 1.3 2.8 1.3s2-.4 2.8-1.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8.2 7.2V8.5M15.8 7.2V8.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconArtifact({ className, title = 'Collection' }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M7 4h10l-1 7H8L7 4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 11c0 4.5-2 4.5-2 8h10c0-3.5-2-3.5-2-8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 20h11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCheck({ className, title = 'System nominal' }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconAlert({ className, title = 'System alert' }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M12 9v4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 17h.01"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M10.3 4.8 2.7 18a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 4.8a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconGlobe({ className, title = 'World' }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M2 12h20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 2c3 3.6 3 16.4 0 20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 2c-3 3.6-3 16.4 0 20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconHeadphones({ className, title = 'Audio' }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M4 13a8 8 0 0 1 16 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6 13v6a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M18 13v6a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M8 20h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTemple({ className, title = 'Architecture' }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M4 10l8-6 8 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M6 10v10h12V10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 20v-6h6v6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Home({
  assistantText,
  setAssistantText,
  language,
  switchLanguage,
}) {
  const navigate = useNavigate();
  const strings = t[language] || t['en-US'];

  // ── Live Firestore subscriptions ──
  const { data: bots, loading: botsLoading } = useBots();
  const { data: artifacts, loading: artifactsLoading } = useArtifacts();

  const [typedQuestion, setTypedQuestion] = useState('');
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Cancel token: set .current = true to stop any running typeText interval
  const cancelTyping = useRef(false);

  // ── Voice pipeline (Whisper + Piper) ──
  const { wsRef, wsReady } = useVoiceWS();
  const voiceSessionRef = useRef(null);  // holds { stop } from startVoiceRecognition
  const [voiceStatus, setVoiceStatus] = useState('idle'); // 'idle' | 'recording' | 'processing'

  // ── Derived dashboard values ──
  const totalBots = bots?.length ?? '—';
  const totalArtifacts = artifacts?.length ?? '—';

  const alertBots = (bots ?? []).filter((b) => b.status === 'alert');
  const activeAlerts = alertBots.length;

  const alertArtifacts = (artifacts ?? []).filter((a) => a.status === 'alert');
  const activeArtifactAlerts = alertArtifacts.length;

  let systemHealth;

  if (activeArtifactAlerts > 0) {
    systemHealth = `${activeArtifactAlerts} artifact${activeArtifactAlerts !== 1 ? 's' : ''} in alert`;
  } else if (activeAlerts > 0) {
    systemHealth = `${activeAlerts} bot${activeAlerts !== 1 ? 's' : ''} in alert`;
  } else if (activeAlerts === 0 && activeArtifactAlerts === 0) {
    systemHealth = 'All systems nominal';
  } else {
    systemHealth = `${activeAlerts} bot${activeAlerts !== 1 ? 's' : ''} in alert` + `${activeArtifactAlerts} artifact${activeArtifactAlerts !== 1 ? 's' : ''} in alert`;
  }
  const healthIsGood = activeAlerts === 0 && activeArtifactAlerts === 0;

  const dashboardLoading = botsLoading || artifactsLoading;

  const botStatusCounts = (bots ?? []).reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  // ── Handlers ──

  function handleLanguage(nextLang) {
    const next = nextLang ? { value: nextLang } : getNextLanguage(language);
    switchLanguage(next.value);
    const msg = languageChangedMessage(next.value);
    setAssistantText(msg);
    speak(msg, next.value);
  }

  async function typeResponse(text) {
    cancelTyping.current = true;
    await new Promise((r) => setTimeout(r, 0));
    cancelTyping.current = false;

    setIsTyping(true);
    speak(text, language);   // ← now calls Piper via /api/tts
    setDisplayedText('');

    await typeText({
      text,
      speed: 26,
      cancelRef: cancelTyping,
      onTick: setDisplayedText,
      onDone: (finalText) => {
        setAssistantText(finalText);
        setIsTyping(false);
      },
    });
  }

  // ── Voice: push-to-talk via Whisper + Piper ──────────────────────────────
  //
  // First press  → start recording mic
  // Second press → stop recording, send audio to server
  //
  // Server pipeline: webm → ffmpeg → Whisper → /api/ask → voiceTranscript WS message
  // Client on reply: displays "You asked: …", types + speaks the MUSE response

  async function startListening() {
    const ws = wsRef.current;

    // Second press while recording → stop and send
    if (voiceStatus === 'recording') {
      voiceSessionRef.current?.stop();
      setVoiceStatus('processing');
      setAssistantText(strings.thinking);
      return;
    }

    // Guard: don't start if WS isn't open or already processing
    if (!wsReady || voiceStatus === 'processing') {
      setAssistantText('Voice service not connected. Please wait…');
      return;
    }

    // Wire up the reply handler BEFORE recording starts so we don't miss the message
    const cleanup = onVoiceReply(ws, {
      onUserText: (raw) => {
        setAssistantText(`${strings.youAsked}: "${raw}"`);
      },
      onResult: async (aiText) => {
        cleanup();                  // detach listener
        setVoiceStatus('idle');
        await typeResponse(aiText); // types text + plays Piper audio
      },
      onError: (err) => {
        cleanup();
        setVoiceStatus('idle');
        console.error('[Voice]', err);
        setAssistantText(strings.voiceError);
      },
    });

    voiceSessionRef.current = startVoiceRecognition({
      lang: language,
      ws,
      onStop:  () => setVoiceStatus('processing'),
      onError: (err) => {
        cleanup();
        setVoiceStatus('idle');
        setAssistantText(strings.voiceError);
        console.error('[Mic]', err);
      },
    });

    setVoiceStatus('recording');
    setAssistantText(strings.listening);
  }

  async function askMuse(question) {
    try {
      setAssistantText(strings.thinking);
      setDisplayedText('');
      const data = await askMuseApi({ question, language });
      await typeResponse(data.text);
    } catch (err) {
      console.error(err);
      setAssistantText(strings.unavailable);
    }
  }

  function listenToAssistant() {
    speak(assistantText, language);
  }

  async function handleTypedAsk() {
    if (!typedQuestion.trim()) return;
    const q = typedQuestion;
    setTypedQuestion('');
    await askMuse(q);
  }

  function handleTour() {
    setAssistantText(strings.tourMsg);
    speak(strings.tourMsg, language);
    socket.emit('robotCommand', { command: 'startTour' });
  }

  return (
    <>
      <div className="background-glow" />

      <Sidebar onAskMuse={startListening} onTour={handleTour} onLanguage={handleLanguage} language={language} />

      <main className="main-content">
        <section className="hero-card">
          <div className="hero-text">
            <div className="heading">{strings.tagline}</div>
            <h1>{strings.heroTitle}</h1>
            <p>{strings.heroDesc}</p>
            <div className="hero-buttons">
              <button className="gold-btn" onClick={() => navigate('/artifacts')}>
                {strings.exploreBtn}
              </button>

              {/* Voice button — shows recording state */}
              <button
                className="glass-btn"
                onClick={startListening}
                disabled={!wsReady && voiceStatus === 'idle'}
                style={
                  voiceStatus === 'recording'
                    ? { borderColor: '#e53935', color: '#e53935' }
                    : !wsReady
                    ? { opacity: 0.5 }
                    : {}
                }
              >
                {voiceStatus === 'recording'
                  ? '● Stop'
                  : voiceStatus === 'processing'
                  ? strings.thinking
                  : strings.speakBtn}
              </button>

              <button className="glass-btn" onClick={handleTour}>
                {strings.tourBtn}
              </button>
            </div>

            {/* Small indicator when voice WS is offline */}
            {!wsReady && (
              <p style={{ fontSize: '.75rem', color: '#ff5050', marginTop: '8px' }}>
                ⚠ Voice pipeline offline
              </p>
            )}
          </div>
          <div className="hero-robot">
            <div className="robot-circle">
              <img src="/images/logo.png" alt="MUSE Robot" className="robot-image" />
            </div>
          </div>
        </section>

        {/* ── LIVE FIRESTORE DASHBOARD ── */}
        <section className="feature-grid" style={{ marginBottom: '2rem' }}>
          {/* Fleet card */}
          <div className="feature-card">
            <div className='feature-wrapper' style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-flex', color: 'var(--gold)' }}>
              <IconRobot />
            </span>
            <h3 style={{ fontFamily: 'Cinzel, serif' }}>Fleet</h3>
            </div>
            <div
              style={{
                fontSize: '2.4rem',
                fontWeight: 700,
                fontFamily: 'Cinzel, serif',
                color: 'var(--gold)',
              }}
            >
              {botsLoading ? '…' : totalBots}
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>Active Bots</p>
            {!botsLoading && bots && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {Object.entries(botStatusCounts).map(([status, count]) => (
                  <span
                    key={status}
                    style={{
                      fontSize: '.72rem',
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background:
                        status === 'alert'
                          ? 'rgba(255,80,80,.15)'
                          : status === 'charging'
                            ? 'rgba(80,200,255,.12)'
                            : 'rgba(179,139,89,.12)',
                      color:
                        status === 'alert'
                          ? '#ff5050'
                          : status === 'charging'
                            ? '#50c8ff'
                            : 'var(--gold)',
                      border: '1px solid currentColor',
                      opacity: 0.8,
                    }}
                  >
                    {status}: {count}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Collection card */}
          <div className="feature-card">
            <div className='feature-wrapper' style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-flex', color: 'var(--gold)' }}>
              <IconArtifact />
            </span>
            <h3 style={{ fontFamily: 'Cinzel, serif' }}>Collection</h3>
            </div>
            <div
              style={{
                fontSize: '2.4rem',
                fontWeight: 700,
                fontFamily: 'Cinzel, serif',
                color: 'var(--gold)',
              }}
            >
              {artifactsLoading ? '…' : totalArtifacts}
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>Artifacts on Display</p>
          </div>

          {/* System health */}
          <div
            className="feature-card"
            style={{
              borderColor: healthIsGood ? 'rgba(80,200,120,.3)' : 'rgba(255,80,80,.3)',
              background: healthIsGood ? 'rgba(80,200,120,.04)' : 'rgba(255,80,80,.04)',
            }}
          >
            <div className='feature-wrapper' style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-flex', color: healthIsGood ? '#50c878' : '#ff5050' }}>
              {healthIsGood ? <IconCheck /> : <IconAlert />}
            </span>
            <h3 style={{ fontFamily: 'Cinzel, serif' }}>System Health</h3>
            </div>
            <div
              style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: healthIsGood ? '#50c878' : '#ff5050',
                letterSpacing: '.04em',
              }}
            >
              {dashboardLoading ? '…' : systemHealth}
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '.9rem', marginTop: '8px' }}>
              {botsLoading
                ? 'Checking fleet…'
                : activeAlerts === 0 && activeArtifactAlerts === 0
                  ? 'All systems nominal'
                  : `${activeAlerts} bot${activeAlerts !== 1 ? 's' : ''} in alert`}
            </p>
          </div>
        </section>

        <section className="feature-grid">
          <div className="feature-card">
            <div className='feature-wrapper' style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-flex', color: 'var(--gold)' }}>
              <IconTemple />
            </span>
            <h3>{strings.feat1Title}</h3>
            </div>
            <p>{strings.feat1Desc}</p>
          </div>
          <div className="feature-card">
            <div className='feature-wrapper' style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-flex', color: 'var(--gold)' }}>
              <IconHeadphones />
            </span>
            <h3>{strings.feat2Title}</h3>
            </div>
            <p>{strings.feat2Desc}</p>
          </div>
          <div className="feature-card">
            <div className='feature-wrapper' style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ display: 'inline-flex', color: 'var(--gold)' }}>
              <IconGlobe />
            </span>
            <h3>{strings.feat3Title}</h3>
            </div>
            <p>{strings.feat3Desc}</p>
          </div>
        </section>

        <section className="assistant-panel">
          <div className="assistant-header">
            <div>
              <h2 style={{ fontFamily: 'Cinzel, serif', marginBottom: '8px' }}>{strings.assistantTitle}</h2>
              <p style={{ color: 'var(--muted)' }}>{strings.assistantSubtitle}</p>
            </div>
            <div className="status">
              <span className="status-indicator" />
              {strings.online}
            </div>
          </div>
          <div className="assistant-message">
            <>
              {(isTyping ? displayedText : assistantText) || strings.defaultMsg}
              {isTyping && <span style={{ animation: 'blink 1s infinite' }}>|</span>}
            </>
          </div>
          <div style={{ display: 'flex', gap: '14px', marginTop: '24px' }}>
            <input
              id="searchInput"
              type="text"
              placeholder={strings.inputPlaceholder}
              value={typedQuestion}
              onChange={(e) => setTypedQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTypedAsk()}
            />
            <button className="gold-btn" onClick={handleTypedAsk}>
              {strings.askBtn}
            </button>
            <button
              className="glass-btn"
              onClick={listenToAssistant}
              style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <span className="material-symbols-rounded">volume_up</span>
              {strings.listenBtn}
            </button>
            <button
              className="glass-btn"
              onClick={stopSpeaking}
              style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
            >
              <span className="material-symbols-rounded">stop_circle</span>
              {strings.stopBtn}
            </button>
          </div>
        </section>
      </main>
    </>
  );
}