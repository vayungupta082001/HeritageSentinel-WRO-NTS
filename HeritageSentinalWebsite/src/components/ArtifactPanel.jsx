import { useState, useRef } from 'react';
import { t } from '../utils/translations';
import { speak, stopSpeaking } from '../utils/speak';

import {
  startVoiceRecognition,
  onVoiceReply
} from '../utils/speechRecognition';

import { useVoiceWS } from '../utils/useVoiceWS.js';

import { db } from "../firebaseConfig";

import {
  doc,
  getDoc
} from "firebase/firestore";

const CloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </svg>
);

const MicrophoneIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <path d="M12 17v4" />
    <path d="M8 21h8" />
  </svg>
);

export default function ArtifactPanel({
  artifact,
  onClose,
  language
}) {
  const lang =
    language ||
    localStorage.getItem('language') ||
    'en-US';

  const strings =
    t[lang] ||
    t['en-US'];

  const [aiText,
    setAiText] =
    useState(
      strings.pressExplain
    );

  const [
    typedQuestion,
    setTypedQuestion
  ] = useState('');

  const [loading,
    setLoading] =
    useState(false);

  const [
    chatLoading,
    setChatLoading
  ] = useState(false);

  const [
    hasExplained,
    setHasExplained
  ] = useState(false);

  const [
    isExpanded,
    setIsExpanded
  ] = useState(false);

  const { wsRef, wsReady } = useVoiceWS();

  const voiceSessionRef = useRef(null);

  const [voiceStatus, setVoiceStatus] =
    useState('idle');

  if (!artifact) {
    return null;
  }

  async function explainArtifact() {
    setLoading(true);
    setAiText(
      strings.analyzingMsg
    );

    try {
      const response =
        await fetch(
          '/api/explain-artifact',
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify({
                artifact,
                language: lang
              })
          }
        );

      const data =
        await response.json();

      setAiText(
        data.text
      );

      setHasExplained(true);
      setIsExpanded(true);

      speak(
        data.text,
        lang
      );

    } catch (err) {
      console.error(err);

      setAiText(
        strings.explainError
      );
    }

    setLoading(false);
  }

  async function askMuse(
    question,
    artifactId
  ) {
    if (
      !question.trim()
    ) return;

    if (
      !hasExplained
    ) {
      setAiText(
        strings.chatDisabled
      );
      return;
    }

    try {
      setChatLoading(true);
      setAiText(
        strings.thinking
      );

      let context =
        '';

      try {
        const artifactRef =
          doc(
            db,
            'artifacts',
            artifactId
          );

        const artifactSnap =
          await getDoc(
            artifactRef
          );

        if (
          artifactSnap.exists()
        ) {
          context =
            artifactSnap.data()
              .context ||
            '';
        }

      } catch (firebaseErr) {
        console.error(
          'Context fetch failed:',
          firebaseErr
        );
      }

      const response =
        await fetch(
          '/api/ask',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify({
                question,
                context,
                language:
                  lang
              })
          }
        );

      const data =
        await response.json();

      setAiText(
        data.text ||
        strings.unavailable
      );

      speak(
        data.text,
        lang
      );

    } catch (err) {
      console.error(err);

      setAiText(
        strings.unavailable
      );
    }

    setChatLoading(false);
  }

  async function handleTypedAsk(
    artifactId
  ) {
    if (
      !typedQuestion.trim()
    ) return;

    const q =
      typedQuestion;

    setTypedQuestion(
      ''
    );

    await askMuse(
      q,
      artifactId
    );
  }

  async function startListening() {
    if (!hasExplained) {
      setAiText(strings.chatDisabled);
      return;
    }

    const ws = wsRef.current;

    if (voiceStatus === 'recording') {
      voiceSessionRef.current?.stop();

      setVoiceStatus('processing');

      setAiText(strings.thinking);

      return;
    }

    if (!wsReady || voiceStatus === 'processing') {
      setAiText('Voice service not connected.');
      return;
    }

    const cleanup = onVoiceReply(ws, {
      onUserText: (raw) => {
        setAiText(`${strings.youAsked}: "${raw}"`);
      },

      onResult: async (aiText) => {
        cleanup();

        setVoiceStatus('idle');

        setAiText(aiText);

        speak(aiText, lang);
      },

      onError: (err) => {
        cleanup();

        console.error(err);

        setVoiceStatus('idle');

        setAiText(strings.voiceError);
      },
    });

    voiceSessionRef.current = startVoiceRecognition({
      lang,
      ws,

      onStop: () => {
        setVoiceStatus('processing');
      },

      onError: (err) => {
        cleanup();

        console.error(err);

        setVoiceStatus('idle');

        setAiText(strings.voiceError);
      },
    });

    setVoiceStatus('recording');

    setAiText(strings.listening);
  }

  function listenToArtifact() {
    speak(
      `${artifact.name}. ${artifact.description}. ${aiText}`,
      lang
    );
  }

  return (
    <div className="artifact-panel">
      <div
        className="panel-overlay"
        onClick={onClose}
      />

      <div className="panel-inner">

        <button
          className="close-panel-btn"
          onClick={onClose}
        >
          <CloseIcon />
        </button>

        <div className="artifact-hero">
          <img
            className="panel-image"
            src={artifact.image}
            alt={
              artifact.name
            }
          />

          <div className="image-overlay">
            <div
              style={{
                display:
                  'flex',
                flexDirection:
                  'column',
                gap:
                  '12px'
              }}
            >
              <div className="panel-category">
                {
                  artifact.category
                }
              </div>

              <div
                style={{
                  color:
                    'white'
                }}
              >
                <div
                  style={{
                    fontSize:
                      '.95rem',
                    opacity:
                      .9
                  }}
                >
                  {
                    strings.museumExhibit
                  }
                </div>

                <div
                  style={{
                    fontSize:
                      '1.8rem',
                    fontWeight:
                      '700',
                    fontFamily:
                      'Cinzel, serif'
                  }}
                >
                  {
                    artifact.name
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel-content">

          <div className="title-row">
            <div>
              <h2>
                {
                  artifact.name
                }
              </h2>

              <p className="panel-era">
                {
                  artifact.era
                }
              </p>
            </div>
          </div>

          <div className="museum-divider" />

          <div className="info-section">
            <h3>
              {
                strings.historicalContext
              }
            </h3>

            <p className="panel-description">
              {
                artifact.description
              }
            </p>
          </div>

          <div
            className="ai-box"
            style={{
              overflow: 'visible',
              position: 'relative',
              zIndex: 2
            }}
          >
            <div className="ai-header">
              <div>
                <h3>
                  {
                    strings.museInsight
                  }
                </h3>

                <p>
                  {
                    strings.aiExplanation
                  }
                </p>
              </div>

              <button
                className="ai-toggle"
                type="button"
                onClick={() =>
                  setIsExpanded(
                    prev =>
                      !prev
                  )
                }
              >
                {isExpanded
                  ? strings.collapseInsight
                  : strings.expandInsight}
              </button>
            </div>

            {isExpanded && (
              <>
                <p
                  className="ai-text"
                  style={{
                    lineHeight:
                      '1.9',
                    color:
                      '#4b3d2e'
                  }}
                >
                  {aiText}
                </p>

                <div
                  className="question-input chat-input"
                  style={{
                    marginTop:
                      '24px',
                    position:
                      'relative',
                    zIndex:
                      9999,
                    pointerEvents:
                      'auto'
                  }}
                >
                  <input
                    type="text"
                    placeholder={
                      strings.askQuestion
                    }
                    value={
                      typedQuestion
                    }
                    onChange={e =>
                      setTypedQuestion(
                        e.target.value
                      )
                    }
                    onKeyDown={e =>
                      e.key ===
                        'Enter' &&
                      handleTypedAsk(
                        artifact.id
                      )
                    }
                    disabled={
                      !hasExplained
                    }
                  />

                  <button
                    className="gold-btn"
                    onClick={() =>
                      handleTypedAsk(
                        artifact.id
                      )
                    }
                    disabled={
                      !hasExplained ||
                      !typedQuestion.trim() ||
                      chatLoading
                    }
                  >
                    {
                      strings.askBtn
                    }
                  </button>

                  <button
                    className="glass-btn"
                    onClick={
                      startListening
                    }
                    disabled={
                      !hasExplained ||
                      (!wsReady &&
                        voiceStatus ===
                          'idle')
                    }
                    style={
                      voiceStatus ===
                      'recording'
                        ? {
                            borderColor:
                              '#e53935',
                            color:
                              '#e53935'
                          }
                        : {}
                    }
                  >
                    {
                      voiceStatus ===
                      'recording'
                        ? '●'
                        : voiceStatus ===
                          'processing'
                        ? '...'
                        : <MicrophoneIcon />
                    }
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="panel-buttons">
            <button
              className="gold-btn"
              onClick={
                explainArtifact
              }
            >
              {
                strings.explainBtn
              }
            </button>

            <button
              className="glass-btn"
              onClick={
                listenToArtifact
              }
            >
              {
                strings.listenBtn
              }
            </button>

            <button
              className="glass-btn"
              onClick={
                stopSpeaking
              }
            >
              {
                strings.stopBtn
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}