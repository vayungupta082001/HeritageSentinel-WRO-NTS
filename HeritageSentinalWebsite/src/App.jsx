import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Artifacts from './pages/Artifacts';
import Map from './pages/Map';
import './index.css';
import Settings from './pages/Settings';
import MapGenerator from './pages/MapGenerator';
import { setArtifactsCollectionName } from './services/firebaseService';

export default function App() {
  const [assistantText, setAssistantText] = useState(
    'Hello! I am MUSE, your museum guide. Ask me anything about history or explore artifacts.'
  );

  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || 'en-US';
  });

  function switchLanguage(lang) {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Home
              assistantText={assistantText}
              setAssistantText={setAssistantText}
              language={language}
              switchLanguage={switchLanguage}
            />
          }
        />
        <Route
          path="/artifacts"
          element={
            <Artifacts
              assistantText={assistantText}
              setAssistantText={setAssistantText}
              language={language}
              switchLanguage={switchLanguage}
            />
          }
        />
        <Route
          path="/map"
          element={
            <Map
              language={language}
              switchLanguage={switchLanguage}
            />
          }
        />
        <Route
          path="/settings"
          element={
            <Settings
              assistantText={assistantText}
              setAssistantText={setAssistantText}
              language={language}
              switchLanguage={switchLanguage}
            />
          }
        />

        {/* Developer-only route */}
        {localStorage.getItem('devMode') === 'true' && (
          <Route
            path="/map-generator"
            element={
              <MapGenerator />
            }
          />
        )}
      </Routes>
    </BrowserRouter>
  );
}

// Fetch museum collection from server and configure client Firestore
// This runs after module load to ensure services use the configured collection.
try {
  fetch('/api/museum-config')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data?.collection) setArtifactsCollectionName(data.collection);
    })
    .catch(() => {});
} catch (e) {
  // ignore in environments without fetch
}