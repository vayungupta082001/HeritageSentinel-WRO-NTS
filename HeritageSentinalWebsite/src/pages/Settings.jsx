import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { t } from '../utils/translations';
import { speak } from '../utils/speak';
import { getNextLanguage, languageChangedMessage } from '../utils/language';

import { settingsStore } from '../utils/settingsStore';
import { createArtifact } from '../services/artifactService';
import { setArtifactsCollectionName } from '../services/firebaseService';

function applySettingsToDocument(settings) {
  const { darkMode, highContrast } = settings || {};

  // Dark mode toggle
  document.documentElement.setAttribute(
    'data-dark-mode',
    String(!!darkMode)
  );

  // High contrast toggle
  document.documentElement.setAttribute(
    'data-high-contrast',
    String(!!highContrast)
  );
}

export default function Settings({
  assistantText,
  setAssistantText,
  language,
  switchLanguage
}) {
  const strings =
    t[language] ||
    t['en-US'];

  const [volume, setVolume] =
    useState(() => settingsStore.get().volume);

  const [voiceEnabled,
    setVoiceEnabled] =
    useState(() => settingsStore.get().voiceEnabled);

  const [darkMode,
    setDarkMode] =
    useState(() => settingsStore.get().darkMode);

  const [notifications,
    setNotifications] =
    useState(() => settingsStore.get().notifications);

  const [animations,
    setAnimations] =
    useState(() => settingsStore.get().animations);

  const [highContrast,
    setHighContrast] =
    useState(() => settingsStore.get().highContrast);

  const [autoNarration,
    setAutoNarration] =
    useState(() => settingsStore.get().autoNarration);

  const [fontSize,
    setFontSize] =
    useState(() => settingsStore.get().fontSize);

  const [devMode, setDevMode] = useState(() => localStorage.getItem('devMode') === 'true');
const [showDevModal, setShowDevModal] = useState(false);
const [devCode, setDevCode] = useState('');
const [devError, setDevError] = useState('');
  const [museumName, setMuseumName] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [artifactsUploading, setArtifactsUploading] = useState(false);
  const [lastUploadedLogoUrl, setLastUploadedLogoUrl] = useState(null);

async function handleDevUnlock() {
  const res = await fetch('/api/dev-unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: devCode })
  });
  const data = await res.json();
  if (data.success) {
    localStorage.setItem('devMode', 'true');
    setDevMode(true);
    setShowDevModal(false);
    setDevCode('');
    setDevError('');
  } else {
    setDevError('Invalid code.');
  }
}

  function persist(next) {
    const updated = settingsStore.set(next);
    applySettingsToDocument(updated);
  }

  useEffect(() => {
    // Apply on mount so toggles affect UI immediately.
    applySettingsToDocument(settingsStore.get());
  }, []);


  function handleLanguage(
    nextLang
  ) {
    const next =
      nextLang
        ? { value: nextLang }
        : getNextLanguage(
            language
          );

    switchLanguage(
      next.value
    );

    const msg =
      languageChangedMessage(
        next.value
      );

    setAssistantText(msg);

    speak(
      msg,
      next.value
    );
  }

  function Toggle({
    active,
    onClick
  }) {
    return (
      <button
        className={`toggle ${
          active
            ? 'active'
            : ''
        }`}
        onClick={onClick}
      >
        <div className="toggle-ball" />
      </button>
    );
  }

    function slugify(text) {
      return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    async function handleSetMuseum() {
      if (!museumName.trim()) return;
      try {
        const res = await fetch('/api/set-museum', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ museumName })
        });
        const data = await res.json();
        if (data?.success && data.collection) {
          setArtifactsCollectionName(data.collection);
          setAssistantText(`Museum configured: ${data.collection}`);
          localStorage.setItem('museumCollection', data.collection);
        }
      } catch (err) {
        console.error(err);
      }
    }

    async function handleLogoChange(file) {
      if (!file) return;
      setLogoUploading(true);
      try {
        const fd = new FormData();
        fd.append('logo', file);
        const res = await fetch('/api/upload-logo', { method: 'POST', body: fd });
        const data = await res.json();
        if (data?.success && data.imageUrl) {
          setLastUploadedLogoUrl(data.imageUrl);
          setAssistantText('Logo uploaded');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLogoUploading(false);
      }
    }

    async function handleArtifactsFile(file) {
      if (!file) return;
      if (!museumName.trim()) {
        setAssistantText('Set museum name first.');
        return;
      }

      setArtifactsUploading(true);
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          setAssistantText('Artifacts file must be a JSON array');
          return;
        }

        // Ensure server-side collection is set
        await handleSetMuseum();

        // Create documents in configured collection via artifactService
        for (const item of parsed) {
          const artifact = { ...item };
          if (!artifact.uid) {
            artifact.uid = `ART_${slugify(artifact.name || Date.now())}`;
          }
          try {
            await createArtifact(artifact);
          } catch (err) {
            console.error('Create artifact failed', err, artifact.uid);
          }
        }

        setAssistantText('Artifacts uploaded');
      } catch (err) {
        console.error(err);
        setAssistantText('Failed to parse artifacts file');
      } finally {
        setArtifactsUploading(false);
      }
    }

  return (
    <div className="settings-page">
      <div className="background-glow" />

      <Sidebar
        language={language}
        onLanguage={
          handleLanguage
        }
      />

      <main className="main-content">

        <section className="page-header">
          <div className="settings-badge">
            ⚙ {strings.settings || 'Settings'}
          </div>

          <h1>
            {strings.settings ||
              'Settings'}
          </h1>

          <p>
              { strings.settingsDescription ||
                'Customize your experience. Changes apply immediately.' }
          </p>
        </section>

        <section className="settings-grid">


          <div className="setting-card">
            <div className="setting-title">
              {strings.volume || 'Volume'}
            </div>

            <p>
              {strings.volumeDescription ||
                'Adjust the assistant voice volume.'}
            </p>

            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={e => {
                const v = Number(e.target.value);
                setVolume(v);
                persist({ volume: v });
              }}
              className="volume-slider"
            />

            <div className="volume-value">
              {volume}%
            </div>
          </div>



          <div className="setting-card">
            <div className="setting-row">
              <div>
                <div className="setting-title">
                  {strings.darkMode || 'Dark Mode'}
                </div>
                <p>
                  {strings.darkModeDescription || 'Switch theme appearance.'}
                </p>
              </div>

              <Toggle
                active={darkMode}
                onClick={() => {
                  const next = !darkMode;
                  setDarkMode(next);
                  persist({ darkMode: next });
                }}
              />
            </div>
          </div>

          <div className="setting-card">
            <div className="setting-row">
              <div>
                <div className="setting-title">
                  {strings.highContrast || 'High Contrast'}
                </div>
                <p>
                  {strings.highContrastDescription || 'Accessibility visibility mode.'}
                </p>
              </div>

              <Toggle
                active={highContrast, darkMode}
                onClick={() => {
                  const next = !highContrast && !darkMode; // Force high contrast on if dark mode is enabled, since dark mode relies on it for visibility.
                  setHighContrast(next);
                  persist({ highContrast: next });
                  persist({ darkMode: next ? true : darkMode }); // If enabling high contrast, also enable dark mode for best experience. If disabling, leave dark mode as is since it can be used without high contrast (though not recommended).
                }}
              />
            </div>
          </div>

<div className="setting-card">
  <div className="setting-row">
    <div>
      <div className="setting-title">{strings.devMode || '🛠 Developer Mode'}</div>
      <p>{devMode ? (strings.devModeEnabled || 'Enabled — Map Generator unlocked.') : (strings.devModeDisabled || 'Enter code to unlock dev tools.')}</p>
    </div>
    <button className="toggle" onClick={() => devMode ? (localStorage.removeItem('devMode'), setDevMode(false)) : setShowDevModal(true)}>
      <div className="toggle-ball" />
    </button>
  </div>
</div>

{showDevModal && (
  <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
    <div style={{background:'var(--card-bg, #fff)',borderRadius:12,padding:32,minWidth:300,display:'flex',flexDirection:'column',gap:12}}>
      <div style={{fontWeight:'bold',fontSize:'1.1rem'}}>Enter Dev Code</div>
      <input
        type="password"
        value={devCode}
        onChange={e => { setDevCode(e.target.value); setDevError(''); }}
        onKeyDown={e => e.key === 'Enter' && handleDevUnlock()}
        placeholder="Code"
        style={{padding:'8px 12px',borderRadius:6,border:'1px solid #ccc',fontSize:'1rem'}}
        autoFocus
      />
      {devError && <div style={{color:'red',fontSize:'0.85rem'}}>{devError}</div>}
      <div style={{display:'flex',gap:8}}>
        <button onClick={handleDevUnlock} style={{flex:1,padding:'8px',borderRadius:6,background:'#c9a96e',border:'none',cursor:'pointer',fontWeight:'bold'}}>Unlock</button>
        <button onClick={() => { setShowDevModal(false); setDevCode(''); setDevError(''); }} style={{flex:1,padding:'8px',borderRadius:6,border:'1px solid #ccc',cursor:'pointer'}}>Cancel</button>
      </div>
    </div>
  </div>
)}

{devMode && (
  <div className="setting-card">
    <div className="setting-title">Developer Tools</div>
    <p>Dev-only utilities: configure museum collection, upload logo, import artifacts.</p>

    <div style={{display:'flex',gap:8,flexDirection:'column',marginTop:8}}>
      <label style={{fontSize:'0.9rem'}}>Museum Name</label>
      <div style={{display:'flex',gap:8}}>
        <input value={museumName} onChange={e=>setMuseumName(e.target.value)} placeholder="My Museum" style={{flex:1,padding:'8px'}} />
        <button onClick={handleSetMuseum} style={{padding:'8px 12px'}}>Set</button>
      </div>

      <div style={{marginTop:12}}>
        <label style={{fontSize:'0.9rem'}}>Upload Logo</label>
        <input type="file" accept="image/*" onChange={e=>handleLogoChange(e.target.files?.[0])} />
        {logoUploading && <div style={{fontSize:'0.85rem'}}>Uploading...</div>}
        {lastUploadedLogoUrl && <div style={{fontSize:'0.85rem'}}>Uploaded: {lastUploadedLogoUrl}</div>}
      </div>

      <div style={{marginTop:12}}>
        <label style={{fontSize:'0.9rem'}}>Import Artifacts (JSON array)</label>
        <input type="file" accept="application/json" onChange={e=>handleArtifactsFile(e.target.files?.[0])} />
        {artifactsUploading && <div style={{fontSize:'0.85rem'}}>Importing artifacts...</div>}
      </div>
    </div>
  </div>
)}
        </section>
      </main>
    </div>
  );
}
