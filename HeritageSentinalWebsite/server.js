require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const WebSocket = require("ws");
const os = require("os");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin:
      process.env.SOCKETIO_CORS_ORIGIN ||
      process.env.SOCKETIO_ORIGIN ||
      false,
    methods: ["GET", "POST"],
    credentials: true
  }
});

const PORT = process.env.PORT || 3000;

const fs = require('fs');
const multer = require('multer');

// Dynamic museum collection name (defaults to 'artifacts')
let MUSEUM_COLLECTION = process.env.MUSEUM_COLLECTION || 'artifacts';


/*
  OPENCLAW API
*/
const OPENCLAW_URL =
  process.env.OPENCLAW_URL ||
  "http://localhost:11434/v1/chat/completions";

/*
  BLYNK CONFIG
  Set BLYNK_TOKEN in your .env file.
  BLYNK_PIN should be the virtual pin (e.g. "V0") that holds the JSON command string.
*/
const BLYNK_TOKEN = process.env.BLYNK_TOKEN || '';
const BLYNK_PIN   = process.env.BLYNK_PIN   || 'V0';

/*
  PIPER TTS CONFIG
  Edit these to match your install paths, or set in .env
*/
const PIPER_EXE        = process.env.PIPER_EXE        || 'C:\\piper\\piper\\piper.exe';
const PIPER_MODEL_PATH = process.env.PIPER_MODEL_PATH || 'C:\\piper\\piper\\models\\en_US-lessac-medium.onnx';
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'medium';

/**
 * Sends a robot command array to the ESP32 via Blynk.
 */
async function sendToBlynk(commands) {
  if (!BLYNK_TOKEN) {
    console.warn('[Blynk] BLYNK_TOKEN not set — skipping Blynk push');
    return;
  }

  const json = JSON.stringify(commands);

  const url =
    `https://blynk.cloud/external/api/update` +
    `?token=${BLYNK_TOKEN}` +
    `&${BLYNK_PIN}=${encodeURIComponent(json)}`;

  const res = await fetch(url);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Blynk update failed: ${res.status} ${body}`);
  }

  console.log(`[Blynk] Commands sent to ${BLYNK_PIN}:`, json);
}


// ── Firebase setup ─────────────────────────────────────────────────
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, updateDoc, serverTimestamp, collection, addDoc } = require('firebase/firestore');
const firebaseApp = initializeApp({
  apiKey:            process.env.VITE_FIREBASE_API_KEY,
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.VITE_FIREBASE_APP_ID,
});

const db = getFirestore(firebaseApp);


// ── Token → Blynk auth map (one per device) ───────────────────────
const SECURITY_DEVICES = [
  { token: 'MOS49nmG1jWz0S6tFh9pB_kZBP_tMXA7', artifactId: 'ART_001' },
  { token: 'tlCpzyeNmk9y8PkGDyBa_X8SNN276dEx', artifactId: 'ART_002' },
  { token: 'ReusV5d3iekLMA1eFMvDGsPKILwqvU1J', artifactId: 'ART_003' },
];

const alertStates = {};

async function pollSecuritySensors() {
  for (const device of SECURITY_DEVICES) {
    try {
      const res = await fetch(
        `https://blynk.cloud/external/api/get?token=${device.token}&V3`
      );
      if (!res.ok) continue;

      const raw = await res.text();
      let isAlert = false;

      try {
        const parsed = JSON.parse(raw);
        isAlert = parsed.alert === 1;
      } catch {
        // fallback: plain 0/1
        isAlert = raw.trim() === '1';
      }

      const wasAlert = alertStates[device.artifactId];

      if (isAlert === wasAlert) continue;

      alertStates[device.artifactId] = isAlert;
      console.log(`[Security] ${device.artifactId} → ${isAlert ? '🚨 ALERT' : '✅ clear'}`);

      // Push status to OLED display device
      const LCD_TOKEN = 'ReusV5d3iekLMA1eFMvDGsPKILwqvU1J';
      const statusStr = `${device.artifactId}:${isAlert ? 'alert' : 'on_display'}`;
      await fetch(`https://blynk.cloud/external/api/update?token=${LCD_TOKEN}&V4=${encodeURIComponent(statusStr)}`);

      await updateDoc(doc(db, MUSEUM_COLLECTION, device.artifactId), {
        status: isAlert ? 'alert' : 'on_display',
        lastUpdated: serverTimestamp(),
      });

if (isAlert) {
  await triggerBlynkAlarm(device.token, device.artifactId);

  // Log to security_logs collection
  await addDoc(collection(db, 'security_logs'), {
    Artifact_Id: device.artifactId,
    robot_in_alert: null,
    timestamp: serverTimestamp(),
  });

  console.log(`[Security] Log added for ${device.artifactId}`);
}
      io.emit('securityAlert', { artifactId: device.artifactId, alert: isAlert });

    } catch (err) {
      console.error(`[Security] Poll failed for ${device.artifactId}:`, err.message);
    }
  }
}

setInterval(pollSecuritySensors, 2000);

async function triggerBlynkAlarm(token, artifactId) {
  // Write 1 to V5 on the specific device to trigger its sound widget
  const url = `https://blynk.cloud/external/api/update?token=${token}&V5=1`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`[Alarm] Failed for ${artifactId}: ${res.status}`);
  } else {
    console.log(`[Alarm] Triggered on ${artifactId}`);
  }
  // Auto-clear after 5 seconds so it doesn't loop
  setTimeout(async () => {
    await fetch(`https://blynk.cloud/external/api/update?token=${token}&V5=0`);
  }, 5000);
}


/*
  SIMPLE IN-MEMORY VISITOR MEMORY
*/
const visitorMemories = new Map();

/*
  GLOBAL MUSE PERSONALITY
*/
const MUSE_SYSTEM_PROMPT = `

You are MUSE, the intelligence of a grand museum — precise, knowledgeable, and direct.

RULES — NEVER BREAK THESE
- 3-4 sentences maximum. Hard limit: 70 words.
- No asterisks, no stage directions, no emojis.
- No filler phrases ("Great question!", "Certainly!", "Of course!").
- Answer the question first. Atmosphere second.

TONE
Sharp and confident. Warm but never theatrical.
You inform, you don't perform.

WHEN APPROPRIATE
- One line of context or wonder after the direct answer.
- A single sharp question to provoke curiosity.
`;

// ── Expanded locale → language label map ──────────────────────────
const LOCALE_TO_LANGUAGE = {
  'en-US': 'English',
  'hi-IN': 'Hindi',
  'fr-FR': 'French',
  'es-ES': 'Spanish',
  'de-DE': 'German',
  'it-IT': 'Italian',
  'pt-PT': 'Portuguese',
  'ru-RU': 'Russian',
  'ar-SA': 'Arabic',
  'tr-TR': 'Turkish',
  'ja-JP': 'Japanese',
  'ko-KR': 'Korean',
  'zh-CN': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  'nl-NL': 'Dutch',
  'sv-SE': 'Swedish',
  'no-NO': 'Norwegian',
  'pl-PL': 'Polish',
  'uk-UA': 'Ukrainian',
  'th-TH': 'Thai',
};

function buildMusePrompt(language) {
  const languageLabel = LOCALE_TO_LANGUAGE[language] || 'English';
  return `${MUSE_SYSTEM_PROMPT}

CRITICAL LANGUAGE RULE:
You MUST respond ONLY in ${languageLabel}. This is non-negotiable.
Do NOT respond in English unless the selected language is English.
Do NOT mix languages. Every word of your response must be in ${languageLabel}.`;
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const uploadDir = path.join(
  __dirname,
  'src',
  'public',
  'images',
);

console.log('UPLOAD DIR:', uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_, __, cb) => {
    cb(null, uploadDir);
  },
  filename: (_, file, cb) => {
    cb(null, 'current-map' + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

app.use(
  '/uploads',
  express.static(uploadDir, {
    etag: false,
    lastModified: false,
    cacheControl: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  })
);

// Return current museum collection configuration
app.get('/api/museum-config', (req, res) => {
  res.json({ collection: MUSEUM_COLLECTION });
});

// Set museum name and derive collection name (stored in-memory)
app.post('/api/set-museum', (req, res) => {
  const { museumName } = req.body || {};
  if (!museumName || typeof museumName !== 'string') {
    return res.status(400).json({ success: false, error: 'museumName required' });
  }

  const sanitized = museumName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  MUSEUM_COLLECTION = `artifacts-${sanitized}`;

  console.log('Museum collection set to', MUSEUM_COLLECTION);

  res.json({ success: true, collection: MUSEUM_COLLECTION });
});

/*
  SERVE FRONTEND
*/
app.use(express.static(path.join(__dirname, "dist")));

/*
  GET OR CREATE VISITOR MEMORY
*/
function getVisitorMemory(sessionId) {
  if (!visitorMemories.has(sessionId)) {
    visitorMemories.set(sessionId, []);
  }
  return visitorMemories.get(sessionId);
}

/*
  SAVE MESSAGE TO MEMORY
*/
function saveToMemory(memory, role, content) {
  memory.push({ role, content });

  /*
    LIMIT MEMORY SIZE
  */
  if (memory.length > 12) {
    memory.splice(0, memory.length - 12);
  }
}

/*
  EXPLAIN ARTIFACT
*/
app.post("/api/explain-artifact", async (req, res) => {
  try {
    const { artifact, visitorType, language = 'en-US' } = req.body;

    const sessionId = req.headers["x-session-id"] || "default";
    const memory = getVisitorMemory(sessionId);

    const artifactContext = `
Current artifact being discussed:

Name: ${artifact.name}
Category: ${artifact.category}
Era: ${artifact.era}

Description:
${artifact.description}
`;

    saveToMemory(memory, "system", artifactContext);

    const audiencePrompt = visitorType
      ? `Visitor type: ${visitorType}`
      : "";

    const prompt = `
A visitor is viewing a museum artifact.

${audiencePrompt}

Artifact Information:

Name:
${artifact.name}

Category:
${artifact.category}

Era:
${artifact.era}

Description:
${artifact.description}

Your task:
- Explain the artifact naturally
- Make it engaging
- Help the visitor imagine its historical use
- Include one memorable detail
- Keep it concise
`;

    saveToMemory(memory, "user", prompt);

    const systemPrompt = buildMusePrompt(language);
    const data = await callOpenclaw({
      model: "gemma4:31b-cloud",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        ...memory.slice(-8)
      ],
      temperature: 0.7,
      max_tokens: 180
    });

    const text =
      data.choices?.[0]?.message?.content ||
      "I could not explain this artifact.";

    saveToMemory(memory, "assistant", text);

    res.json({ success: true, text });

  } catch (err) {
    console.error(err);
    res.json({ success: false, text: "OpenClaw is currently unavailable." });
  }
});

app.post("/api/ask", async (req, res) => {
  try {
    const {
      question,
      context,
      visitorType,
      language = "en-US",
      mapContext
    } = req.body;

    const sessionId = req.headers["x-session-id"] || "default";
    const memory = getVisitorMemory(sessionId);
    const systemPrompt = buildMusePrompt(language);

    if (visitorType) {
      const alreadyHasType = memory.some(
        m => m.role === "system" && m.content?.includes("Visitor type:")
      );

      if (!alreadyHasType) {
        saveToMemory(memory, "system", `Visitor type: ${visitorType}`);
      }
    }

    let dynamicContext = null;
    if (mapContext) {
      dynamicContext = {
        role: "system",
        content: `
You are helping a museum visitor navigate.

Museum locations:
${
  mapContext.locations
    ?.map(l => `- ${l.label}`)
    .join("\n")
}

Visitor current location:
${mapContext.currentLocation || "Unknown"}

VERY IMPORTANT SYSTEM RULE:

If the visitor is asking to go somewhere,
navigate somewhere,
find a place,
or asking where something is:

YOU MUST begin your reply EXACTLY with:

[NAVIGATION]

No exceptions.

Correct examples:

[NAVIGATION] Sure! Let's head to the Cafe.

[NAVIGATION] I can guide you to the AI Research Lab.

Wrong examples:

"Right this way..."
"Let's go there..."

Keep responses concise.
Never invent locations.
`
      };
    }

    saveToMemory(memory, "user", question);

    const messages = [
      {
        role: "system",
        content: systemPrompt
      }
    ];

    if (context) {
      messages.push({
        role: "system",
        content: `
Current artifact context:

${context}

IMPORTANT RULES:
- Answer based on this artifact
- Stay museum focused
- Use the context when relevant
- If the visitor asks about the object,
  assume they mean the currently opened artifact
`
      });
    }

    if (dynamicContext) {
      messages.push(dynamicContext);
    }

    messages.push(...memory.slice(-12));

    const data = await callOpenclaw({
      model: "gemma4:31b-cloud",
      messages,
      temperature: 0.7,
      max_tokens: 180
    });

    let answer = data.choices?.[0]?.message?.content || "I could not answer that.";

    const navKeywords = ['go to', 'take me', 'navigate', 'where is', 'find the', 'how do i get'];
    const isNavQuestion = navKeywords.some(kw => question.toLowerCase().includes(kw));
    if (isNavQuestion && !answer.startsWith('[NAVIGATION]')) {
      answer = '[NAVIGATION] ' + answer;
    }

    saveToMemory(memory, "assistant", answer);

    res.json({ success: true, text: answer });

  } catch (err) {
    console.error(err);
    res.json({ success: false, text: "Museum assistant unavailable." });
  }
});

/*
  RESET MEMORY
*/
app.post("/api/reset-memory", (req, res) => {
  const sessionId = req.headers["x-session-id"] || "default";
  visitorMemories.delete(sessionId);
  res.json({ success: true });
});


/*
  ROBOT POSITION
*/
let robotPosition = {
  x: 50,
  y: 48
};

app.get('/api/robot-position', (req, res) => {
  res.json(robotPosition);
});

app.post('/api/robot-position', (req, res) => {
  const { x, y } = req.body || {};

  if (typeof x === 'number' && typeof y === 'number') {
    robotPosition = { x, y };
    io.emit('robotPosition', robotPosition);
  }

  res.json({ success: true, position: robotPosition });
});

// ── Poll robot position from Blynk V2 ─────────────────────────────
async function pollBlynkPosition() {
  if (!BLYNK_TOKEN) return;

  try {
    const res = await fetch(
      `https://blynk.cloud/external/api/get?token=${BLYNK_TOKEN}&pin=V2`
    );

    if (!res.ok) {
      console.warn('[Blynk Poll] HTTP error:', res.status);
      return;
    }

    const raw = await res.text();

    let x, y, heading = 0;

    if (typeof raw === 'string' && raw.includes(',')) {
      const parts = raw.trim().split(',');
      x = parseFloat(parts[0]);
      y = parseFloat(parts[1]);
      heading = parseFloat(parts[2]) || 0;
    } else {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          x = parseFloat(parsed[0]);
          y = parseFloat(parsed[1]);
          heading = parseFloat(parsed[2]) || 0;
        } else {
          console.warn('[Blynk Poll] Unexpected JSON shape:', parsed);
          return;
        }
      } catch {
        console.warn('[Blynk Poll] Could not parse:', raw);
        return;
      }
    }

    if (!isNaN(x) && !isNaN(y)) {
      robotPosition = { x, y, heading };
      io.emit('robotPosition', robotPosition);
      // console.log(`[Blynk Poll] Position updated → x=${x} y=${y} hdg=${heading}`);
    }

  } catch (err) {
    console.error('[Blynk Poll] Failed:', err.message);
  }
}

setInterval(pollBlynkPosition, 1000);


async function callOpenclaw(payload) {
  const res = await fetch(OPENCLAW_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenClaw request failed: ${res.status} ${text}`);
  }

  return res.json();
}


// ─────────────────────────────────────────────────────────────────────────────
// PIPER TTS  —  POST /api/tts
// speak.js on the client calls this. Returns a WAV file.
// ─────────────────────────────────────────────────────────────────────────────

// Map short lang codes (from speak.js) to Piper model paths
// Add or change entries here to match the model files you have installed
const TTS_MODELS = {
  'en': process.env.PIPER_MODEL_EN || PIPER_MODEL_PATH,
  // 'hi': process.env.PIPER_MODEL_HI || 'C:\\piper\\piper\\models\\hi_IN-priyamvada-medium.onnx',
  'hi': process.env.PIPER_MODEL_HI || '.\\PiperModels\\hi_IN-priyamvada-medium.onnx',
  'fr': process.env.PIPER_MODEL_FR || '.\\PiperModels\\fr_FR-upmc-medium.onnx',
  'es': process.env.PIPER_MODEL_ES || '.\\PiperModels\\es_ES-sharvard-medium.onnx',
  'de': process.env.PIPER_MODEL_DE || '.\\PiperModels\\de_DE-thorsten-medium.onnx',
  'it': process.env.PIPER_MODEL_IT || '.\\PiperModels\\it_IT-riccardo-x_low.onnx',
  'ru': process.env.PIPER_MODEL_RU || '.\\PiperModels\\ru_RU-ruslan-medium.onnx',
  'zh': process.env.PIPER_MODEL_ZH || '.\\PiperModels\\zh_CN-huayan-medium.onnx',
};

app.post('/api/tts', async (req, res) => {
  const text = (req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'No text provided' });

  // lang comes from speak.js as the first part of the locale, e.g. 'hi' from 'hi-IN'
  const lang = (req.body?.lang || 'en').split('-')[0].toLowerCase();
  const modelPath = TTS_MODELS[lang] || TTS_MODELS['en'];

  const timestamp = Date.now();
  const txtPath = path.join(os.tmpdir(), `tts_${timestamp}.txt`);
  const outPath = path.join(os.tmpdir(), `tts_${timestamp}.wav`);

  try {
    // Write text to a temp file so special characters and newlines are safe
    fs.writeFileSync(txtPath, text, 'utf8');

    await run(
      `"${PIPER_EXE}" --model "${modelPath}" --output_file "${outPath}" < "${txtPath}"`
    );

    res.setHeader('Content-Type', 'audio/wav');
    const stream = fs.createReadStream(outPath);
    stream.pipe(res);
    stream.on('end', () => {
      if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
      if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
    });
  } catch (err) {
    console.error('[TTS]', err.message);
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// VOICE WEBSOCKET  —  ws://host:PORT/voice
//
// Separate from socket.io so binary audio frames don't collide with JSON.
// Pipeline: webm blob → ffmpeg → WAV → Whisper → /api/ask → reply JSON
// ─────────────────────────────────────────────────────────────────────────────

const voiceWss = new WebSocket.Server({ server, path: '/voice' });


voiceWss.on('connection', (ws, req) => {
  const clientIP = req.socket.remoteAddress;
  let pendingLang = 'en-US';

  console.log(`[VoiceWS] Client connected: ${clientIP}`);

  ws.on('message', async (data, isBinary) => {

    // ── JSON control frame (voiceMeta carries the language) ──────
    if (!isBinary) {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'voiceMeta') {
          pendingLang = msg.lang || 'en-US';
          console.log(`[VoiceWS] Language set to: ${pendingLang}`);
        }
      } catch { /* ignore non-JSON text frames */ }
      return;
    }

    // ── Binary frame = audio blob ─────────────────────────────────
    console.log(`[VoiceWS] Audio received: ${data.length} bytes`);

    const inputPath = path.join(os.tmpdir(), `voice_${Date.now()}.webm`);
    const wavPath   = inputPath.replace('.webm', '.wav');

    try {
      fs.writeFileSync(inputPath, data);

      await run(`ffmpeg -y -i "${inputPath}" -ar 16000 -ac 1 "${wavPath}"`);

      const transcriptBase = wavPath.replace('.wav', '');
// const whisperLang = pendingLang.split('-')[0];

await run(
  `python -m whisper "${wavPath}" --model ${WHISPER_MODEL} --output_format txt --output_dir "${path.dirname(wavPath)}"`
);

      const transcriptPath = `${transcriptBase}.txt`;
      let userText = '';
      if (fs.existsSync(transcriptPath)) {
        userText = fs.readFileSync(transcriptPath, 'utf8').trim();
        fs.unlinkSync(transcriptPath);
      }

      console.log(`[Whisper] "${userText}"`);

      const aiRes = await fetch(`http://127.0.0.1:${PORT}/api/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': `voice_${clientIP}`
        },
        body: JSON.stringify({
          question: userText,
          language: pendingLang        // ← uses client's selected language
        })
      });

      const aiData = await aiRes.json();
      const aiText = aiData?.text || "I'm sorry, I couldn't process that.";

      console.log(`[MuseVoice] "${aiText}"`);

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'voiceTranscript',
          user: userText,
          text: aiText,
        }));
      }

    } catch (err) {
      console.error('[VoiceWS error]', err.message);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'voiceError', message: err.message }));
      }
    } finally {
      [inputPath, wavPath].forEach(f => {
        if (fs.existsSync(f)) fs.unlinkSync(f);
      });
    }
  });

  ws.on('close', () => console.log(`[VoiceWS] Disconnected: ${clientIP}`));
  ws.on('error', (e) => console.error('[VoiceWS]', e.message));
});


// ─────────────────────────────────────────────────────────────────────────────
// SHARED EXEC HELPER
// ─────────────────────────────────────────────────────────────────────────────

function run(cmd) {
  return new Promise((resolve, reject) => {
    console.log(`[exec] ${cmd}`);
    require('child_process').exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}


/*
  SOCKET.IO
  TOUCHSCREEN ↔ ROBOT
*/
io.on("connection", socket => {
  console.log("Touchscreen Connected");

  socket.on("robotCommand", data => {
    console.log("Robot Command:", data);

    socket.emit("robotReply", {
      text: `Robot command received: ${data.command}`
    });
  });

  socket.on("visitorMessage", async data => {
    try {
      const {
        message,
        sessionId = socket.id,
        language = 'en-US'        // accept language from the client
      } = data;

      const memory = getVisitorMemory(sessionId);
      saveToMemory(memory, "user", message);

      const systemPrompt = buildMusePrompt(language);

      const result = await callOpenclaw({
        model: "gemma4:31b-cloud",
        messages: [
          { role: "system", content: systemPrompt },
          ...memory.slice(-8)
        ],
        temperature: 0.7,
        max_tokens: 180
      });

      const reply =
        result.choices?.[0]?.message?.content ||
        "I could not respond.";

      saveToMemory(memory, "assistant", reply);

      socket.emit("museReply", { text: reply });

    } catch (err) {
      console.error(err);
      socket.emit("museReply", { text: "Museum assistant unavailable." });
    }
  });

  socket.on("disconnect", () => {
    console.log("Touchscreen disconnected");
  });
});

app.post('/api/navigate', async (req, res) => {
  const {
    destination,
    coordinates,
    source,
    instructions
  } = req.body || {};

  console.log('========== NAVIGATION REQUEST ==========');
  console.log('Destination :', destination);
  console.log('Coordinates :', coordinates);
  console.log('Requested From:', source);
  console.log('Instructions:', instructions?.length ?? 0, 'steps');
  console.log('========================================');

  if (!instructions || instructions.length === 0) {
    console.warn('[Navigate] No instructions received — skipping Blynk push');
    return res.json({ success: true, blynk: false, reason: 'no instructions' });
  }

  try {
    await sendToBlynk(instructions);
    res.json({ success: true, blynk: true, steps: instructions.length });
  } catch (err) {
    console.error('[Navigate] Blynk push failed:', err.message);
    res.json({ success: true, blynk: false, reason: err.message });
  }
});

/* DEVELOPER TEST ENDPOINT */
app.post('/api/dev-unlock', (req, res) => {
  const { code } = req.body || {};
  if (code === process.env.DEV_CODE) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});


app.post('/api/save-map', async (req, res) => {
  try {
    const mapData = req.body;

    const filePath = path.join(
      __dirname,
      'src',
      'utils',
      'mapData.js'
    );

    const fileContent = `
export const GRID_STEP =
  ${mapData.GRID_STEP};

export const ZONE_RECTS =
  ${JSON.stringify(mapData.ZONE_RECTS, null, 2)};

export const ZONE_CONNECTIONS =
  ${JSON.stringify(mapData.ZONE_CONNECTIONS, null, 2)};

export const NAV_NODES =
  ${JSON.stringify(mapData.NAV_NODES, null, 2)};

export const LOCATIONS =
  ${JSON.stringify(mapData.LOCATIONS, null, 2)};
export const ZONE_NODE_KEYS = new Map(
  Object.entries(${JSON.stringify(mapData.ZONE_NODE_KEYS || {}, null, 2)})
    .map(([k, v]) => [k, new Set(v)])
);
`;

    fs.writeFileSync(filePath, fileContent, 'utf8');

    console.log('✓ mapData.js updated');

    res.json({ success: true });

  } catch (err) {
    console.error('Save map failed:', err);
    res.status(500).json({ success: false });
  }
});

app.post(
  '/api/upload-map-image',
  upload.single('map'),
  (req, res) => {
    console.log('Upload received:', req.file?.filename);
    console.log('Files in uploadDir:', fs.readdirSync(uploadDir));

    if (!req.file) {
      return res.status(400).json({ success: false });
    }

    const existing = fs.readdirSync(uploadDir);
    existing
      .filter(f => f.startsWith('current-map') && f !== req.file.filename)
      .forEach(f => {
        console.log('Deleting:', f);
        fs.unlinkSync(path.join(uploadDir, f));
      });

    res.json({
      success: true,
      imageUrl: `/uploads/${req.file.filename}`
    });
  }
);

// Upload museum logo (dev mode)
const logoStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadDir),
  filename: (_, file, cb) => {
    cb(null, 'museum-logo' + path.extname(file.originalname));
  }
});

const uploadLogo = multer({ storage: logoStorage });

app.post('/api/upload-logo', uploadLogo.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false });
  res.json({ success: true, imageUrl: `/uploads/${req.file.filename}` });
});

app.get('/api/map-image', (req, res) => {
  const files = fs.readdirSync(uploadDir);

  const mapFile = files.find(file => file.startsWith('current-map'));

  if (!mapFile) {
    return res.json({ imageUrl: '/images/museum-map.png' });
  }

  res.json({ imageUrl: `/uploads/${mapFile}` });
});


app.get("/{*path}", (req, res) => {
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
    return;
  }

  res.status(404).end();
});


/*
  START SERVER
*/
server.listen(PORT, () => {
  console.log(`Museum Robot Running: http://localhost:${PORT}`);
});