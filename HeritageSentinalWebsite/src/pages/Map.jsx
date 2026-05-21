import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { t } from '../utils/translations';
import { getNextLanguage, languageChangedMessage } from '../utils/language';
import { speak } from '../utils/speak';
import { LOCATIONS, NAV_NODES } from '../utils/mapData';
import { findPath, getNearestLocation } from '../utils/pathfinding';
import { smoothPath, pathToSvgD, pathToInstructions, instructionsToString } from '../utils/pathTranslator';

const MAP_FEATURES = [
  { key: 'feature1Title', keyDesc: 'feature1Desc' },
  { key: 'feature2Title', keyDesc: 'feature2Desc' },
  { key: 'feature3Title', keyDesc: 'feature3Desc' }
];

export default function Map({
  language,
  switchLanguage
}) {
  const strings =
    t[language] || t['en-US'];


  const [initialLocation,
    setInitialLocation] =
    useState(null);

const [isSettingInitialPosition, setIsSettingInitialPosition] =
  useState(false);
  
  const [targetPos, setTargetPos] =
    useState({ x: 50, y: 48 });

  const [selectedItem,
    setSelectedItem] =
    useState(null);

  const [searchQuery,
    setSearchQuery] =
    useState('');

  const [chatQuery,
    setChatQuery] =
    useState('');

  const [chatResponse,
    setChatResponse] =
    useState(strings.chatIntro);

  const [chatBusy,
    setChatBusy] =
    useState(false);

  const [routePath,
    setRoutePath] =
    useState([]);

  const [isFullscreen,
    setIsFullscreen] =
    useState(false);

  const [selectedArtifact, setSelectedArtifact] = useState(null);
  const [clickTarget, setClickTarget] = useState(null); // {x, y} in map % coords

  const [displayedText,
  setDisplayedText] =
  useState('');

const [isTyping,
  setIsTyping] =
  useState(false);


  const [activeWaypoint, setActiveWaypoint] =
  useState(null);

  const [showNavigateButton,
  setShowNavigateButton] =
  useState(false);


  const [sessionId] = useState(
    'map-visitor-' + Date.now()
  );

  // Initialize with cafe node coordinates — the robot's known home position.
  // This shows the correct blue-dot location immediately on first render,
  // before the async /api/robot-position response comes back.
  const [initialPos, setInitialPos] =
    useState({ x: 50.0, y: 83.5 }); // cafe_c coordinates

  /*
    LOAD ROBOT POSITION
    Falls back to hallway node
  */

    const [mapImage,
  setMapImage] =
  useState(
    '/images/museum-map.png'
  );
useEffect(() => {
  async function loadPosition() {
    try {
      const response = await fetch('/api/robot-position');

      if (!response.ok) throw new Error();

      const data = await response.json();
      const robotPos = { x: data.x, y: data.y };
      
      setInitialPos(robotPos);
      setTargetPos(robotPos);

      // getNearestLocation returns a full LOCATIONS entry which has navNode
      const nearest = getNearestLocation(robotPos.x, robotPos.y);
      setInitialLocation(nearest);
      setSelectedItem(nearest);

    } catch {
      // API unavailable — fall back to the robot's known home position (Cafe).
      // Using a fixed node guarantees a deterministic, visible starting point
      // instead of a random accessible node that could be anywhere on the map.
      const cafeLocation = LOCATIONS.find(l => l.id === 'cafe')
        ?? LOCATIONS[LOCATIONS.length - 1];

      const cafeNode = NAV_NODES.find(n => n.id === (cafeLocation?.navNode ?? 'cafe_c'));
      const fallback = cafeNode
        ? { x: cafeNode.x, y: cafeNode.y }
        : { x: 50.0, y: 83.5 };

      setInitialPos(fallback);
      setTargetPos(fallback);

      setInitialLocation(cafeLocation ?? null);
      setSelectedItem(cafeLocation ?? null);
    }
  }
  
  loadPosition();
}, []);

useEffect(() => {
  async function loadMapImage() {
    try {
      const response =
        await fetch(
          '/api/map-image'
        );

      const data =
        await response.json();

      setMapImage(
        data.imageUrl
      );
    } catch {
      setMapImage(
        '/images/museum-map.png'
      );
    }
  }

  loadMapImage();
}, []);
  /*
    SEARCH RESULTS
  */
const visibleResults =
  useMemo(() => {

    const query =
      searchQuery
        .trim()
        .toLowerCase();

    if (!query) {
      return LOCATIONS;
    }

    return LOCATIONS.filter(
      item =>
        (
          item.label ??
          item.name ??
          ''
        )
          .toLowerCase()
          .includes(query)
    );
  }, [searchQuery]);
  /*
    SELECT DESTINATION
  */
const selectMapItem = item => {
  setSelectedItem(item);
  setClickTarget(null);
setShowNavigateButton(
  true
);
  const target = {
    x: item.center.x,
    y: item.center.y
  };
  setTargetPos(target);

  // Snap target to its navNode
  const targetNavNode = item.navNode
    ? NAV_NODES.find(n => n.id === item.navNode)
    : null;
  const snappedTarget = targetNavNode
    ? { x: targetNavNode.x, y: targetNavNode.y }
    : target;
const { path } = findPath(initialPos, snappedTarget);
setRoutePath(path);
const instructions = pathToInstructions(path);
console.log(instructionsToString(instructions));

  setSearchQuery('');

  const label = item.label ?? item.name ?? 'Destination';
  const info = item.info ?? item.type ?? `Navigating to ${label}.`;
  setChatResponse(`${label} is selected. ${info}`);
};
  /*
    MAP CLICK → PATHFIND TO ARBITRARY POINT
    */
async function sendNavigationRequest(
  item
) {
  // Compute the path and translate it to robot instructions
  const targetNavNode = item?.navNode
    ? NAV_NODES.find(n => n.id === item.navNode)
    : null;

  const snappedTarget = targetNavNode
    ? { x: targetNavNode.x, y: targetNavNode.y }
    : { x: item?.center?.x ?? targetPos.x, y: item?.center?.y ?? targetPos.y };

  const { path } = findPath(initialPos, snappedTarget);
  const instructions = pathToInstructions(path);

  console.log('[Navigate] Sending instructions:', instructionsToString(instructions));

  try {
    await fetch(
      '/api/navigate',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json'
        },
        body: JSON.stringify({
          destination:
            item?.label,
          coordinates: {
            x:
              item?.center?.x ??
              targetPos.x,

            y:
              item?.center?.y ??
              targetPos.y
          },
          source:
            'map-ui',
          instructions   // ← robot command array forwarded to Blynk
        })
      }
    );
  } catch (err) {
    console.error(
      'Navigation failed:',
      err
    );
  }
}

const handleMapClick = (event) => {
  const rect = event.currentTarget.getBoundingClientRect();

  const x =
    ((event.clientX - rect.left) / rect.width) * 100;

  const y =
    ((event.clientY - rect.top) / rect.height) * 100;

  // =====================================================
  // SET INITIAL POSITION MODE
  // =====================================================

  if (isSettingInitialPosition) {

    // snap to nearest nav node
    let nearestNode = NAV_NODES[0];
    let bestDist = Infinity;

    for (const node of NAV_NODES) {

      const dx = node.x - x;
      const dy = node.y - y;

      const dist = dx * dx + dy * dy;

      if (dist < bestDist) {
        bestDist = dist;
        nearestNode = node;
      }
    }

    const snappedPos = {
      x: nearestNode.x,
      y: nearestNode.y
    };

    setInitialPos(snappedPos);

    const nearestLocation =
      getNearestLocation(
        snappedPos.x,
        snappedPos.y
      );

    setInitialLocation(nearestLocation);

    setIsSettingInitialPosition(false);

    setChatResponse(
      `Initial position set near ${nearestLocation.label}.`
    );

    return;
  }

  // =====================================================
  // NORMAL DESTINATION CLICK
  // =====================================================

  const target = { x, y };

  setClickTarget(target);
  setTargetPos(target);

  const { path } =
    findPath(initialPos, target);

 setRoutePath(path);

  const nearest =
    getNearestLocation(x, y);

  const label =
    nearest.label ??
    nearest.name ??
    'Nearby location';

  setSelectedItem({
    ...nearest,
    label,
    info:
      `Navigating to a point near ${label}.`
    }
);
setShowNavigateButton(
  true
)
  const instructions =
    pathToInstructions(path);

  console.log(
    instructionsToString(instructions)
  );
};

  /*
    SEARCH SUBMIT
  */
  const handleSearchSubmit =
    () => {
      const query =
        searchQuery
          .trim()
          .toLowerCase();

      if (!query) return;

      const match =
        LOCATIONS.find(
          item =>
            item.label
              .toLowerCase()
              .includes(query)
        );

      if (match) {
        selectMapItem(match);
        return;
      }

      setChatResponse(
        strings.noSearchMatch
      );
    };

async function typeResponse(text) {
  setIsTyping(true);
  setDisplayedText('');

  let current = '';
  const speed = 16;

  for (let i = 0; i < text.length; i++) {
    current += text[i];
    setDisplayedText(current);

    await new Promise(resolve => setTimeout(resolve, speed));
  }

  setIsTyping(false);
}

// used by the chat flow
// (kept here to match the original logic)


  const handleChatAsk =
    async () => {
      const question =
        chatQuery.trim();

      if (!question) {
        return;
      }

      setChatBusy(true);

      try {
        const mapData = {
          currentPosition:
            initialPos,

          currentLocation:
            initialLocation
              ?.label,

          targetPosition:
            targetPos,

          targetLocation:
            selectedItem
              ?.label,

          locations:
            LOCATIONS.map(
              l => ({
                label:
                  l.label,
                center:
                  l.center
              })
            )
        };

        const response =
          await fetch(
            '/api/ask',
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
                'x-session-id':
                  sessionId
              },
              body:
                JSON.stringify({
                  question,
                  language,
                  visitorType:
                    'map-navigation',
                  mapContext:
                    mapData
                })
            }
          );

        const data =
          await response.json();

let responseText =
  data.text ||
  strings
    .mapChatFallback;
if (responseText.startsWith('[NAVIGATION]')) {
  responseText = responseText.replace('[NAVIGATION]', '').trim();

  // Search both the question AND the AI response for a location name
  const searchIn = (question + ' ' + responseText).toLowerCase();
  
  const match = LOCATIONS.find(location =>
    searchIn.includes(location.label.toLowerCase())
  );

  if (match) {
    selectMapItem(match);
    sendNavigationRequest(match);
  }
}

setChatResponse(
  responseText
);

      } catch (err) {
        console.error(err);

        setChatResponse(
          strings
            .mapChatFallback
        );
      } finally {
        setChatBusy(false);
      }

      setChatQuery('');
    };

  /*
    LANGUAGE
  */
  function handleLanguage(nextLang) {
    const next = nextLang
      ? { value: nextLang }
      : getNextLanguage(language);

    switchLanguage(next.value);

    const msg = languageChangedMessage(next.value);
    speak(msg, next.value);
  }
function toggleFullscreen() {
  const elem =
    document.querySelector(
      '.map-frame'
    );

  if (!document.fullscreenElement) {
    elem?.requestFullscreen();

    setIsFullscreen(
      true
    );
  } else {
    document.exitFullscreen();

    setIsFullscreen(
      false
    );
  }
}
  return (
    <div className="map-page">
      <Sidebar
        onLanguage={handleLanguage}
        language={language}
      />

      <main className="main-content">
        <section className="page-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '8px 16px', borderRadius: '999px',
                background: 'rgba(179,139,89,.12)', border: '1px solid rgba(179,139,89,.16)',
                marginBottom: '16px', fontWeight: '600', color: 'var(--gold)'
              }}>
                {strings.mapTag}
              </div>
              <h1>{strings.mapTitle}</h1>
              <p>{strings.mapDesc}</p>
            </div>
          </div>
        </section>

        <section className="map-search-section">
          <label className="search-label" htmlFor="map-search-input">{strings.searchLabel}</label>
          <div className="search-bar-container">
            <input
              id="map-search-input"
              type="text"
              value={searchQuery}
              placeholder={strings.searchPlaceholderMap}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSearchSubmit();
              }}
            />
            <button className="gold-btn" type="button" onClick={handleSearchSubmit}>
              {strings.searchBtn}
            </button>
          </div>
          {searchQuery && visibleResults.length > 0 && (
 <div
  className="search-suggestions"
  style={{
    maxHeight: '280px',
    overflowY: 'auto',
    marginTop: '12px',
    borderRadius: '20px',
    background:
      'rgba(255,255,255,.94)',
    backdropFilter:
      'blur(16px)',
    boxShadow:
      '0 10px 40px rgba(0,0,0,.08)',
    border:
      '1px solid rgba(0,0,0,.05)'
  }}
>
  {visibleResults.map(
    (item) => (
      <button
        key={item.label}
        type="button"
        onClick={() =>
          selectMapItem(item)
        }
      >
        <span>
          {item.label}
        </span>

        <small>
          {item.type}
        </small>
      </button>
    )
  )}
</div>
          )}
        </section>

        <section className="map-grid">
          <div className="map-visual">
  <div
  style={{
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap'
  }}
>
  <button
    className="gold-btn"
    type="button"
    onClick={() =>
      setIsSettingInitialPosition(v => !v)
    }
    style={{
      background:
        isSettingInitialPosition
          ? '#d77e2e'
          : undefined
    }}
  >
    {isSettingInitialPosition
      ? 'Click Map To Place Start'
      : 'Set Initial Position'}
  </button>
</div>
            <div
  className="map-frame"
  onClick={(e) => {
    setActiveWaypoint(null);
    handleMapClick(e);
  }} style={{ cursor: 'crosshair' }}>

<img
  src={mapImage}
  alt={strings.mapAlt}
/>
<button
  onClick={
    toggleFullscreen
  }
  style={{
    position:
      'absolute',
    top: 18,
    right: 18,
    zIndex: 10,
    border: 'none',
    borderRadius: 16,
    padding:
      '10px 16px',
    background:
      'rgba(255,255,255,.9)',
    boxShadow:
      '0 6px 18px rgba(0,0,0,.12)',
    cursor:
      'pointer',
    fontWeight: 700
  }}
>
  {isFullscreen
    ? 'Exit Fullscreen'
    : 'Fullscreen'}
</button>
  {/* ROUTE SVG */}
<svg
  className="map-route-line"
  style={{
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    overflow: 'visible'
  }}
  viewBox="0 0 100 100"
  preserveAspectRatio="none"
>
    {/* Animated route */}
    {routePath.length > 1 && (
      <>
        <defs>
          <filter id="routeGlow">
            <feGaussianBlur
              stdDeviation="0.4"
              result="coloredBlur"
            />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Glow path */}
        <path
          d={pathToSvgD(
            routePath.filter(p => p.id !== '__start__' && p.id !== '__goal__')
          )}
          fill="none"
          stroke="rgba(215,126,46,.22)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#routeGlow)"
        />

        {/* Main path */}
<path
  d={pathToSvgD(
    routePath.filter(p => p.id !== '__start__' && p.id !== '__goal__')
  )}
  fill="none"
  stroke="#d77e2e"
  strokeWidth="0.75"
  strokeLinecap="round"
  strokeLinejoin="round"
/>
      </>
    )}

    {/* Destination pulse */}
    {selectedItem && (
      <circle
        cx={targetPos.x}
        cy={targetPos.y}
        r="1.8"
        fill="rgba(215,126,46,.15)"
      >
        <animate
          attributeName="r"
          values="1.5;3.2;1.5"
          dur="1.8s"
          repeatCount="indefinite"
        />
      </circle>
    )}
    {/* Click-destination X marker */}
    {clickTarget && (
      <g>
        <circle
          cx={clickTarget.x}
          cy={clickTarget.y}
          r="2.2"
          fill="none"
          stroke="#d77e2e"
          strokeWidth="0.5"
          opacity="0.5"
        />
        <line x1={clickTarget.x - 1.2} y1={clickTarget.y - 1.2} x2={clickTarget.x + 1.2} y2={clickTarget.y + 1.2} stroke="#d77e2e" strokeWidth="0.6" strokeLinecap="round" />
        <line x1={clickTarget.x + 1.2} y1={clickTarget.y - 1.2} x2={clickTarget.x - 1.2} y2={clickTarget.y + 1.2} stroke="#d77e2e" strokeWidth="0.6" strokeLinecap="round" />
      </g>
    )}
  </svg>

  {/* DESTINATION PIN */}
  {(clickTarget || selectedItem) && (
    <div
      className="map-pin"
      style={{
        left: `${(clickTarget ?? targetPos).x}%`,
        top: `${(clickTarget ?? targetPos).y}%`,
        zIndex: 4
      }}
    >
      <div className="pin-ring" />
      <div className="pin-dot" />
    </div>
  )}

  {/* CURRENT POSITION */}
  <div
    className="map-pin map-start-pin"
    style={{
      left: `${initialPos.x}%`,
      top: `${initialPos.y}%`,
      zIndex: 5
    }}
  >
    <div className="pin-ring start-ring" />
    <div className="pin-dot start-dot" />
  </div>
  {/* LOCATION WAYPOINTS */}
{LOCATIONS.map(location => {

  const isArtifact =
    location.type === 'Artifact' ||
    location.type === 'Exhibit' ||
    location.type === 'Archive' ||
    location.type === 'Interactive';

  const isService =
    location.type === 'Service' ||
    location.type === 'Cafe';

  const isActive =
    activeWaypoint === location.id;

  // keep safely inside bounds
  const x =
    Math.min(
      97,
      Math.max(3, location.center.x)
    );

  const y =
    Math.min(
      97,
      Math.max(3, location.center.y)
    );

  return (
    <div
      key={location.id}
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isActive ? 20 : 6
      }}
    >

      {/* WAYPOINT DOT */}
      <button
        onClick={(e) => {

          e.stopPropagation();

          // second tap navigates
          if (isActive) {
            selectMapItem(location);
            return;
          }

          // first tap opens label
          setActiveWaypoint(location.id);
        }}
        style={{
          width: isArtifact ? '10px' : '9px',
          height: isArtifact ? '10px' : '9px',
          borderRadius: '999px',
          border: '2px solid white',
          background:
            isArtifact
              ? '#b7854d'
              : isService
                ? '#4d7bb7'
                : '#8b6b43',
          boxShadow:
            isActive
              ? '0 0 0 6px rgba(183,133,77,.18)'
              : '0 2px 8px rgba(0,0,0,.18)',
          cursor: 'pointer',
          transition: 'all .16s ease',
          padding: 0
        }}
      />

      {/* TAP LABEL */}
      {isActive && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            selectMapItem(location);
          }}
          style={{
            position: 'absolute',
            top: '18px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,.96)',
            padding: '7px 12px',
            borderRadius: '999px',
            whiteSpace: 'nowrap',
            fontSize: '0.74rem',
            fontWeight: 700,
            color: '#553c23',
            boxShadow:
              '0 4px 14px rgba(0,0,0,.12)',
            border:
              '1px solid rgba(180,140,90,.16)',
            cursor: 'pointer'
          }}
        >
          {location.label}
        </button>
      )}
    </div>
  );
})}
          </div>
          <div className="map-badge">
              <strong>{strings.youAreHere}</strong>
              <span>{strings.nearbyLabel} {initialLocation?.label}</span>
            </div>
            <div className="map-chat-card">
              <div className="chat-hint">{strings.chatIntro}</div>
              <div className="chat-input-group">
                <input
                  type="text"
                  value={chatQuery}
                  placeholder={strings.chatPrompt}
                  onChange={(event) => setChatQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleChatAsk();
                  }}
                />
                <button className="gold-btn" type="button" onClick={handleChatAsk}>
                  {strings.chatAskBtn}
                </button>
              </div>
              <div className={`chat-response ${chatBusy ? 'busy' : ''}`}>
                {chatBusy ? strings.thinking : chatResponse}
              </div>
            </div>
          </div>

          <aside className="map-info-card">
            <div className="info-pill">{strings.mapTips}</div>
            <h2>{selectedItem?.label || strings.infoTitle}</h2>
            <p>{selectedItem?.info || strings.infoDesc}</p>
{selectedItem && (
  <button
    className="gold-btn"
    type="button"
    onClick={() =>
      sendNavigationRequest(
        selectedItem
      )
    }
    style={{
      marginTop: '18px',
      width: '100%',
      borderRadius: '18px',
      padding:
        '14px 18px',
      fontSize:
        '1rem',
      fontWeight: 700,
      display: 'flex',
      justifyContent:
        'center',
      alignItems:
        'center',
      gap: '10px',
      boxShadow:
        '0 8px 26px rgba(215,126,46,.22)',
      transform:
        'translateY(0)',
      transition:
        'all .25s ease'
    }}
  >
    Navigate To
    <span>
      {selectedItem.label}
    </span>
  </button>
)}
            <div className="info-stat-grid">
              <div>
                <span>{strings.locationLabel}</span>
                <strong>{initialLocation?.label}</strong>
              </div>
              <div>
                <span>{strings.routeLabel}</span>
                <strong>{strings.routeHint}</strong>
              </div>
            </div>


          </aside>
        </section>

        <section className="map-highlights">
          {MAP_FEATURES.map((feature) => (
            <div key={feature.key} className="feature-card">
              <h3>{strings[feature.key]}</h3>
              <p>{strings[feature.keyDesc]}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}