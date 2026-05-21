/**
 * ============================================================
 * seedFirestore.js  —  Firebase Firestore Seeder
 * ============================================================
 * Initialises all collections with seed data:
 *   /bots         — BOT_001, BOT_002
 *   /artifacts    — ART_001 … ART_005
 *   /alerts       — 0 alerts (clean start)
 *   /admin        — summary aggregation doc
 *   /system       — config doc (AprilTag + fleet mode)
 *   /interactions — empty (populated at runtime)
 *
 * Run with:
 *   cd scripts/firebaseInjector
 *   node seedFirestore.js
 *
 * ARCHITECTURE: This script lives in scripts/firebaseInjector/
 * (the existing injection layer) so all Firestore write tooling
 * is co-located. It uses the Firebase Admin SDK for server-side
 * execution (no browser required).
 * ============================================================
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

// ─── Firebase config (from existing firebaseInjector pattern) ───
const firebaseConfig = {
  apiKey:            process.env.FIREBASE_API_KEY            || 'AIzaSyCidEtiIE9ZeaR9AlEc2mKxlk_CCjQgT9I',
  authDomain:        process.env.FIREBASE_AUTH_DOMAIN        || 'heritage-sentinel.firebaseapp.com',
  projectId:         process.env.FIREBASE_PROJECT_ID         || 'heritage-sentinel',
  storageBucket:     process.env.FIREBASE_STORAGE_BUCKET     || 'heritage-sentinel.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '200584133179',
  appId:             process.env.FIREBASE_APP_ID             || '1:200584133179:web:0846827db1b3580db83a1e',
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ─────────────────────────────────────────────────────────────
// SEED DATA
// ─────────────────────────────────────────────────────────────

const BOTS = [
  {
    uid:              'BOT_001',
    name:             'MUSE-Alpha',
    status:           'idle',
    battery:          92,
    assignedArtifact: 'ART_001',
    currentTour:      null,
    currentGuide:     null,
    interactionID:    null,
    closestArtifact:  'ART_001',
    lastAprilTag:     'TAG_001',       // AprilTag placeholder
    position:         { x: 120, y: 340 }, // museum map coords (pixels)
    mode:             'autonomous',
    lastSeen:         null,            // set to serverTimestamp() on write
  },
  {
    uid:              'BOT_002',
    name:             'MUSE-Beta',
    status:           'charging',
    battery:          34,
    assignedArtifact: null,
    currentTour:      null,
    currentGuide:     null,
    interactionID:    null,
    closestArtifact:  null,
    lastAprilTag:     'TAG_000',       // Charging station tag
    position:         { x: 50, y: 80 },
    mode:             'standby',
    lastSeen:         null,
  },
];

const ARTIFACTS = [
  {
    uid:              'ART_001',
    name:             'Ancient Sword',
    category:         'Weapons',
    era:              '15th Century',
    image:            'https://picsum.photos/600/400?random=1',
    description:      'A sword used by medieval warriors in close combat.',
    context:          'Forged during the Hundred Years War, this blade shows distinct Flemish craftsmanship with a wheel pommel and double-fuller. It was recovered from a Loire Valley battlefield in 1842.',
    interactivePrompt:'What can you tell me about medieval sword fighting techniques?',
    status:           'on_display',
    assignedBot:      'BOT_001',
    nearestBot:       'BOT_001',
    nearestAprilTag:  'TAG_001',
    alertCount:       0,
  },
  {
    uid:              'ART_002',
    name:             'Royal Painting',
    category:         'Paintings',
    era:              '18th Century',
    image:            'https://picsum.photos/600/400?random=2',
    description:      'A portrait of a historical ruler from the royal family.',
    context:          'Oil on canvas, attributed to the circle of Hyacinthe Rigaud. The sitter\'s identity remains debated — the heraldic device suggests minor French nobility circa 1740.',
    interactivePrompt:'Who might this painting portray, and what does their clothing tell us?',
    status:           'on_display',
    assignedBot:      null,
    nearestBot:       null,
    nearestAprilTag:  'TAG_002',
    alertCount:       0,
  },
  {
    uid:              'ART_003',
    name:             'Clay Pottery',
    category:         'Pottery',
    era:              'Ancient Civilization',
    image:            'https://picsum.photos/600/400?random=3',
    description:      'Traditional handcrafted pottery used for storage and rituals.',
    context:          'Wheel-thrown terracotta with red-slip decoration. Carbon dating places it at 3200 BCE, consistent with early Indus Valley period. Storage vessels of this type held grain or olive oil.',
    interactivePrompt:'How was pottery made before the wheel was invented?',
    status:           'on_display',
    assignedBot:      null,
    nearestBot:       null,
    nearestAprilTag:  'TAG_003',
    alertCount:       0,
  },
  {
    uid:              'ART_004',
    name:             'Stone Sculpture',
    category:         'Sculptures',
    era:              '12th Century',
    image:            'https://picsum.photos/600/400?random=4',
    description:      'A sculpture carved from stone by skilled artisans.',
    context:          'Romanesque limestone relief depicting a scene from the Last Judgement. Originally part of a tympanum above a church portal in Burgundy, France. The figures retain traces of original polychrome paint.',
    interactivePrompt:'What stories were medieval sculptures trying to tell their viewers?',
    status:           'on_display',
    assignedBot:      null,
    nearestBot:       null,
    nearestAprilTag:  'TAG_004',
    alertCount:       0,
  },
  {
    uid:              'ART_005',
    name:             'Bronze Helmet',
    category:         'Weapons',
    era:              '9th Century',
    image:            'https://picsum.photos/600/400?random=5',
    description:      'A protective helmet worn by ancient soldiers.',
    context:          'Corinthian-style bronze helmet with cheek guards and nasal bridge. Discovered near Olympia, likely a votive offering. The engraved palmette frieze around the brow ridge is remarkably preserved.',
    interactivePrompt:'How did ancient soldiers protect themselves in battle?',
    status:           'on_display',
    assignedBot:      null,
    nearestBot:       null,
    nearestAprilTag:  'TAG_005',
    alertCount:       0,
  },
];

// Admin aggregation seed — computed from the data above
const ADMIN_SUMMARY = {
  totalBots:      BOTS.length,
  totalArtifacts: ARTIFACTS.length,
  activeAlerts:   0,
  systemHealth:   'ALL GOOD',
};

// System config — feature flags and fleet mode
const SYSTEM_CONFIG = {
  aprilTagEnabled: false,   // Set true when hardware AprilTag scanners are online
  fleetMode:       'autonomous',
  version:         '1.0.0',
};

// ─────────────────────────────────────────────────────────────
// SEED FUNCTION
// ─────────────────────────────────────────────────────────────

async function seed() {
  console.log('🚀  Starting Firestore seed...\n');

  // Firestore WriteBatch — max 500 ops per batch.
  // Our seed is small; one batch is fine.
  const batch = writeBatch(db);

  // ── Bots ──
  console.log('🤖  Seeding /bots ...');
  for (const bot of BOTS) {
    const ref = doc(db, 'bots', bot.uid);
    batch.set(ref, {
      ...bot,
      lastSeen:    serverTimestamp(),
      lastUpdated: serverTimestamp(),
    });
    console.log(`    ✓ ${bot.uid} — ${bot.name} (${bot.status})`);
  }

  // ── Artifacts ──
  console.log('\n🏺  Seeding /artifacts ...');
  for (const artifact of ARTIFACTS) {
    const ref = doc(db, 'artifacts', artifact.uid);
    batch.set(ref, {
      ...artifact,
      lastUpdated: serverTimestamp(),
    });
    console.log(`    ✓ ${artifact.uid} — ${artifact.name}`);
  }

  // ── Admin summary ──
  console.log('\n📊  Seeding /admin/summary ...');
  const summaryRef = doc(db, 'admin', 'summary');
  batch.set(summaryRef, {
    ...ADMIN_SUMMARY,
    lastUpdated: serverTimestamp(),
  });
  console.log(`    ✓ systemHealth: ${ADMIN_SUMMARY.systemHealth}`);

  // ── System config ──
  console.log('\n⚙️   Seeding /system/config ...');
  const configRef = doc(db, 'system', 'config');
  batch.set(configRef, {
    ...SYSTEM_CONFIG,
    lastUpdated: serverTimestamp(),
  });
  console.log(`    ✓ aprilTagEnabled: ${SYSTEM_CONFIG.aprilTagEnabled}`);
  console.log(`    ✓ fleetMode: ${SYSTEM_CONFIG.fleetMode}`);

  // ── Commit ──
  console.log('\n💾  Committing batch...');
  await batch.commit();

  console.log('\n✅  Firestore seed complete!');
  console.log(`    ${BOTS.length} bots  •  ${ARTIFACTS.length} artifacts  •  0 alerts`);
  console.log('\n📋  Collections initialised:');
  console.log('    /bots  /artifacts  /admin  /system');
  console.log('\n📋  Empty collections (populated at runtime):');
  console.log('    /alerts  /interactions  /tours  /guides');
}

seed().catch(err => {
  console.error('\n❌  Seed failed:', err);
  process.exit(1);
});
