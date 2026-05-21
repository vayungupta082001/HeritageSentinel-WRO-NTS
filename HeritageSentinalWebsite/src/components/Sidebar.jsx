import { useNavigate, useLocation } from 'react-router-dom';
import { t } from '../utils/translations';
import { getNextLanguage } from '../utils/language';

const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 10.5L12 3l9 7.5"/>
    <path d="M5 9.5V21h14V9.5"/>
    <path d="M9 21v-6h6v6"/>
  </svg>
);

const ArtifactsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 3h8"/>
    <path d="M9 3v5l-4 6a4 4 0 0 0 3.4 6h7.2A4 4 0 0 0 19 14l-4-6V3"/>
    <path d="M8 12h8"/>
  </svg>
);

const TourIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="5" r="2"/>
    <path d="M12 7v5"/>
    <path d="M8 12l4-2 4 2"/>
    <path d="M10 21l2-6 2 6"/>
  </svg>
);

const LangIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20"/>
    <path d="M12 2a15 15 0 0 1 0 20"/>
    <path d="M12 2a15 15 0 0 0 0 20"/>
  </svg>
);

const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="2" width="6" height="12" rx="3"/>
    <path d="M5 10a7 7 0 0 0 14 0"/>
    <path d="M12 17v4"/>
    <path d="M8 21h8"/>
  </svg>
);

const MapIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const SettingsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle
      cx="12"
      cy="12"
      r="3"
    />

    <path d="M19.4 15a1.7 1.7 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.82-.33 1.7 1.7 0 0 0-1 1.54V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.54 1.7 1.7 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .33-1.82 1.7 1.7 0 0 0-1.54-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.54-1 1.7 1.7 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.82.33h.01A1.7 1.7 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.54h.01a1.7 1.7 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.33 1.82v.01a1.7 1.7 0 0 0 1.54 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.54 1z" />
  </svg>
);

const DevIcon = () => (
       <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
        <polyline points="7 8 3 12 7 16" />

        <polyline points="17 8 21 12 17 16" />

        <line x1="14" y1="4" x2="10" y2="20" />
    </svg>

)

export default function Sidebar({
  onAskMuse,
  onTour,
  onLanguage,
  language,
  hidden
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const lang = language || localStorage.getItem('language') || 'en-US';
  const strings = t[lang] || t['en-US'];

  const isHome = location.pathname === '/';
  const isArtifacts = location.pathname === '/artifacts';
  const isMap = location.pathname === '/map';

  return (
  <aside className={`sidebar ${hidden ? 'hidden' : ''}`} style={{ overflow: 'auto', scrollbarGutter: 'stable', WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
      <div className="logo-section">
        <h1>MUSE</h1>
        <p>Museum Assistant</p>
      </div>

      <nav>
        <button
          className={`nav-btn ${isHome ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          <HomeIcon />
          <span>{strings.home}</span>
        </button>

        <button
          className={`nav-btn ${isArtifacts ? 'active' : ''}`}
          onClick={() => navigate('/artifacts')}
        >
          <ArtifactsIcon />
          <span>{strings.artifacts}</span>
        </button>

        <button
          className={`nav-btn ${isMap ? 'active' : ''}`}
          onClick={() => navigate('/map')}
        >
          <MapIcon />
          <span>{strings.map}</span>
        </button>

        {isHome && onTour && (
          <button className="nav-btn" onClick={onTour}>
            <TourIcon />
            <span>{strings.startTour}</span>
          </button>
        )}

        <button className="nav-btn" onClick={() => navigate('/settings')}>
          <SettingsIcon />
          <span>{strings.settings}</span>
        </button>

        <div className="nav-btn language-switcher">
          <LangIcon />
          <div className="language-switch-body">
            <div className="language-switch-label">
              {strings.language}
              <span className="lang-pill">
                {strings.langLabel}
              </span>
            </div>

            <div className="forward-backward-btns">
              <button
                type="button"
                aria-label="Previous language"
                onClick={() => onLanguage?.(getNextLanguage(lang, true).value)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 15l-6-6-6 6" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Next language"
                onClick={() => onLanguage?.(getNextLanguage(lang).value)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        {localStorage.getItem('devMode') === 'true' && (
  <button className="nav-btn" onClick={() => navigate('/map-generator')}>
    <DevIcon />
    <span>Map Generator</span>
  </button>
)}

      </nav>
    </aside>
  );
}