import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import ArtifactPanel from '../components/ArtifactPanel';
import { t } from '../utils/translations';
import { speak } from '../utils/speak';
import { stopSpeaking } from '../utils/speak';
import { getNextLanguage, languageChangedMessage } from '../utils/language';
import { typeText } from '../utils/typingEffect';
import { askMuse } from '../utils/api';

import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { COLLECTIONS, getArtifactsCollectionName } from '../services/firebaseService';

export default function Artifacts({
  assistantText,
  setAssistantText,
  language,
  switchLanguage
}) {
  const strings = t[language] || t['en-US'];

  const [artifacts, setArtifacts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [previewArtifact, setPreviewArtifact] = useState(null);
  const [selectedArtifact, setSelectedArtifact] = useState(null);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const cancelTyping = useRef(false);

  useEffect(() => {
    async function fetchArtifacts() {
      try {
        const collectionName = getArtifactsCollectionName();

        const querySnapshot = await getDocs(
          collection(db, collectionName)
        );

        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          image: doc.data().img || doc.data().image
        }));

        setArtifacts(data);
      } catch (err) {
        console.error("Failed to load artifacts:", err);
      }
    }

    fetchArtifacts();

    function handleCollectionChange() {
      fetchArtifacts();
    }

    window.addEventListener('artifactsCollectionChanged', handleCollectionChange);

    return () => {
      window.removeEventListener('artifactsCollectionChanged', handleCollectionChange);
    };
  }, []);

  useEffect(() => {
    function handleClick() {
      setPreviewArtifact(null);
    }

    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  function handleLanguage(nextLang) {
    const next = nextLang
      ? { value: nextLang }
      : getNextLanguage(language);

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
    speak(text, language);
    setDisplayedText('');

    await typeText({
      text,
      speed: 16,
      cancelRef: cancelTyping,
      onTick: setDisplayedText,
      onDone: (finalText) => {
        setAssistantText(finalText);
        setIsTyping(false);
      },
    });
  }

  async function askMuseAndType(question) {
    try {
      setAssistantText(strings.thinking);
      setDisplayedText('');

      const data = await askMuse({ question, language });
      await typeResponse(data.text || '');
    } catch (err) {
      console.error(err);
      setAssistantText(strings.unavailable);
    }
  }

  const SEARCH_ALIASES = {
    old: ['ancient', 'historic', 'history', 'artifact'],
    history: ['historic', 'ancient', 'old'],
    weapon: ['sword', 'shield', 'armor', 'battle'],
    painting: ['art', 'portrait', 'canvas'],
    pottery: ['pot', 'vase', 'ceramic'],
    sculpture: ['statue', 'stone', 'carving'],
    robot: ['technology', 'innovation', 'engineering'],
    gold: ['golden', 'metal', 'treasure'],
    ancient: ['old', 'historic', 'history']
  };

  const normalizedSearch = search.trim().toLowerCase();

  const filtered = artifacts.filter(a => {
    const matchesCategory = category === 'all' || a.category === category;

    if (!normalizedSearch) return matchesCategory;

    const searchableText = [a.name, a.category, a.era, a.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const directMatch = searchableText.includes(normalizedSearch);
    const aliasTerms = SEARCH_ALIASES[normalizedSearch] || [];
    const aliasMatch = aliasTerms.some(term => searchableText.includes(term));
    const fuzzyMatch = normalizedSearch.split(' ').some(word => searchableText.includes(word));

    return matchesCategory && (directMatch || aliasMatch || fuzzyMatch);
  });

  return (
    <div className="artifacts-page">
      <div className="background-glow" />

      <Sidebar
        onAskMuse={() => {}}
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
                background: 'rgba(179,139,89,.12)',
                border: '1px solid rgba(179,139,89,.16)',
                marginBottom: '16px', fontWeight: '600', color: 'var(--gold)'
              }}>
                {strings.collectionTag}
              </div>

              <h1>{strings.artifactExplorer}</h1>

              <p>{strings.artifactSubtitle}</p>
            </div>

            <div style={{
              background: 'rgba(255,255,255,.45)',
              border: '1px solid rgba(255,255,255,.55)',
              borderRadius: '24px',
              padding: '18px 24px',
              minWidth: '180px',
              textAlign: 'center',
              backdropFilter: 'blur(18px)'
            }}>
              <div style={{
                fontSize: '.9rem',
                color: 'var(--muted)',
                marginBottom: '8px'
              }}>
                {strings.available}
              </div>

              <div style={{
                fontSize: '2rem',
                fontWeight: '700',
                fontFamily: 'Cinzel, serif'
              }}>
                {isTyping ? displayedText : filtered.length}
              </div>

              <div style={{
                color: 'var(--gold)',
                fontSize: '.95rem'
              }}>
                {strings.artifactsLabel}
              </div>
            </div>
          </div>
        </section>

        <section className="search-bar-container">
          <input
            id="searchInput"
            type="text"
            placeholder={strings.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            id="categoryFilter"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">{strings.allCategories}</option>
            <option value="Weapons">Weapons</option>
            <option value="Paintings">Paintings</option>
            <option value="Pottery">Pottery</option>
            <option value="Sculptures">Sculptures</option>
          </select>
        </section>

        <section className="artifact-grid">
          {filtered.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '80px 20px'
            }}>
              <h2>{strings.noFound}</h2>
              <p>{strings.noFoundSub}</p>
            </div>
          ) : (
            filtered.map(artifact => (
              <div
                key={artifact.id}
                className="artifact-card"
                onClick={(e) => {
                  e.stopPropagation();

                  if (previewArtifact?.id !== artifact.id) {
                    setPreviewArtifact(artifact);
                    return;
                  }

                  setSelectedArtifact(artifact);
                }}
                style={{
                  position: 'relative',
                  overflow: 'visible'
                }}
              >
                <img
                  src={artifact.image}
                  alt={artifact.name}
                />

                <div className="card-content">
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}>
                    <h2>{artifact.name}</h2>

                    <div style={{
                      fontSize: '.8rem',
                      padding: '7px 12px',
                      borderRadius: '999px',
                      background:
                        previewArtifact?.id === artifact.id
                          ? 'rgba(215,126,46,.15)'
                          : 'rgba(179,139,89,.12)',
                      color: 'var(--gold)',
                      transition: '.2s'
                    }}>
                      {
                        previewArtifact?.id === artifact.id
                          ? 'Tap again'
                          : strings.viewLabel
                      }
                    </div>
                  </div>

                  <p>{artifact.era}</p>

                  <small>{artifact.category}</small>
                </div>
              </div>
            ))
          )}
        </section>
      </main>

      {selectedArtifact && (
        <ArtifactPanel
          artifact={selectedArtifact}
          language={language}
          onClose={() => setSelectedArtifact(null)}
        />
      )}
    </div>
  );
}