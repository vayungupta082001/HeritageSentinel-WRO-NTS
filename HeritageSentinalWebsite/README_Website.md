# Heritage Sentinel — Website

A React + Express web application that serves as the control dashboard and visitor interface for the Heritage Sentinel museum robot system. It features **MUSE**, an AI-powered museum guide assistant, real-time robot fleet monitoring, artifact management, interactive museum mapping, and multilingual support.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [External Tools — Install on Every Machine](#external-tools--install-on-every-machine)
- [Environment Setup](#environment-setup)
- [Installation](#installation)
- [Running Locally (Development)](#running-locally-development)
- [Running on a Local Network (LAN Access)](#running-on-a-local-network-lan-access)
- [Building for Production](#building-for-production)
- [AI Backend — Ollama](#ai-backend--ollama)
- [Piper TTS — Setup & Configuration](#piper-tts--setup--configuration)
- [Whisper STT — Setup & Configuration](#whisper-stt--setup--configuration)
- [Changing Machines — Full Checklist](#changing-machines--full-checklist)
- [Firebase Setup](#firebase-setup)
- [Features Overview](#features-overview)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, React Router |
| Backend | Node.js, Express 5, Socket.IO |
| Database | Firebase Firestore |
| Storage | Firebase Storage |
| AI (Local) | Ollama (OpenAI-compatible API) |
| AI (Cloud fallback) | Groq API |
| TTS | Piper TTS (server-side, runs locally) |
| STT | OpenAI Whisper (runs as Python module) |
| Audio conversion | ffmpeg |
| Robot comms | Blynk IoT |
| Real-time | Socket.IO + WebSocket |

---

## Project Structure

```
HeritageSentinalWebsite/
├── server.js              # Express + Socket.IO backend
├── vite.config.js         # Vite dev server config (proxies /api & /socket.io)
├── .env                   # Environment variables (never commit this)
├── src/
│   ├── App.jsx            # Root router
│   ├── pages/
│   │   ├── Home.jsx       # MUSE assistant + robot fleet view
│   │   ├── Artifacts.jsx  # Artifact browser
│   │   ├── Map.jsx        # Live museum map
│   │   ├── MapGenerator.jsx
│   │   └── Settings.jsx
│   ├── components/
│   │   ├── Sidebar.jsx
│   │   └── ArtifactPanel.jsx
│   ├── services/          # Firestore domain services
│   ├── hooks/             # useFirestore, useBots, useArtifacts
│   └── utils/
│       ├── speak.js       # Calls /api/tts → Piper; falls back to browser TTS
│       ├── api.js         # Calls /api/ask → Ollama / Groq
│       ├── useVoiceWS.js  # WebSocket voice pipeline (mic → Whisper → MUSE)
│       └── ...
└── dist/                  # Production build output
```

---

## Prerequisites

The following must be installed on the machine running the server before anything else:

- **Node.js** v18 or later — [nodejs.org](https://nodejs.org)
- **npm** v9 or later (comes with Node)
- **Python** 3.8 or later — [python.org](https://python.org) — needed for Whisper
- **ffmpeg** — needed to convert browser audio to WAV before Whisper processes it
- **Ollama** — for local AI (or use Groq cloud as fallback)
- **Piper TTS** — for server-side voice synthesis (download voices https://huggingface.co/rhasspy/piper-voices/tree/main)
- A Firebase project (Firestore + Storage enabled)

---

## External Tools — Install on Every Machine

These are separate programs that live outside the Node project. Every time you move to a new machine, all of these must be installed manually — `npm install` does not handle them.

### 1. Node.js

Download and install from [nodejs.org](https://nodejs.org). Use the LTS version.

```bash
# Verify install
node -v
npm -v
```

### 2. Python

Download from [python.org](https://python.org). Make sure to tick **"Add Python to PATH"** during the Windows installer.

```bash
# Verify
python --version
# or on some systems:
python3 --version
```

### 3. ffmpeg

ffmpeg converts the browser's `.webm` audio recording into a `.wav` file that Whisper can transcribe. Without it, voice input is completely broken.

**Windows:**
```
1. Download a build from https://ffmpeg.org/download.html
   (or https://github.com/BtbN/FFmpeg-Builds/releases — get ffmpeg-master-latest-win64-gpl.zip)
2. Extract the zip
3. Copy the extracted folder somewhere permanent, e.g. C:\ffmpeg
4. Add C:\ffmpeg\bin to your System PATH:
   Search "Environment Variables" → System Variables → Path → Edit → New → C:\ffmpeg\bin
5. Open a new terminal and verify:
```
```bash
ffmpeg -version
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux / Raspberry Pi:**
```bash
sudo apt install ffmpeg -y
ffmpeg -version
```

### 4. Ollama

For running the MUSE AI locally. See the [AI Backend — Ollama](#ai-backend--ollama) section for full setup.

```bash
# Verify
ollama --version
```

### 5. Piper TTS

For server-side voice synthesis (MUSE speaking back to visitors). See the [Piper TTS](#piper-tts--setup--configuration) section for full setup.

### 6. Whisper

Installed as a Python package — runs via `python -m whisper` from inside `server.js`.

```bash
pip install openai-whisper
# Verify
python -m whisper --help
```

---

## Environment Setup

Copy `.env` to the project root and fill in your values. Every key is explained below.

```env
# ── Server ────────────────────────────────────────────────────────────────────
PORT=3000
# The port the Express backend listens on.
# Change if 3000 is already used on your machine.

# ── AI / LLM ──────────────────────────────────────────────────────────────────
OPENCLAW_URL=http://localhost:11434/v1/chat/completions
# Ollama's local API endpoint. Leave as-is unless you changed Ollama's port.
# If Ollama is running on a different machine on the network, change localhost
# to that machine's IP: http://192.168.1.x:11434/v1/chat/completions

GROQ_API_KEY=your_groq_api_key_here
# Cloud LLM fallback used when Ollama is unavailable.
# Get a free key at https://console.groq.com

# ── Socket.IO CORS ────────────────────────────────────────────────────────────
SOCKETIO_ORIGIN=
SOCKETIO_CORS_ORIGIN=
# Leave both empty during local/LAN development (allows all origins).
# Set to your frontend URL in production, e.g. https://your-domain.com

# ── Firebase ──────────────────────────────────────────────────────────────────
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
# All from Firebase Console → Project Settings → Your apps → Web app config.
# VITE_* prefix is required — Vite only exposes env vars with this prefix to the frontend.

# ── Admin ─────────────────────────────────────────────────────────────────────
DEV_CODE=museum2026
# Password for the Settings page. Change this to something secure.

# ── Blynk IoT (Robot communication) ──────────────────────────────────────────
BLYNK_TOKEN=your_blynk_token
BLYNK_PIN=V0
# Token from your Blynk dashboard. V0 is the virtual pin the robot listens on.

# ── Piper TTS ─────────────────────────────────────────────────────────────────
PIPER_EXE=C:\piper\piper.exe
# Full path to the piper executable on this machine.
# Windows example: C:\piper\piper.exe
# Linux/Mac example: /usr/local/bin/piper

PIPER_MODEL_PATH=C:\piper\models\en_US-lessac-medium.onnx
# Default model used for English TTS.

# Per-language model overrides (optional — only needed if you support other languages)
PIPER_MODEL_EN=C:\piper\models\en_US-lessac-medium.onnx
PIPER_MODEL_HI=C:\piper\models\hi_IN-priyamvada-medium.onnx
PIPER_MODEL_FR=C:\piper\models\fr_FR-upmc-medium.onnx
PIPER_MODEL_ES=C:\piper\models\es_ES-sharvard-medium.onnx
PIPER_MODEL_DE=C:\piper\models\de_DE-thorsten-medium.onnx
PIPER_MODEL_IT=C:\piper\models\it_IT-riccardo-x_low.onnx
PIPER_MODEL_RU=C:\piper\models\ru_RU-ruslan-medium.onnx
PIPER_MODEL_ZH=C:\piper\models\zh_CN-huayan-medium.onnx
# Paths must match where you saved the .onnx model files on THIS machine.
# Download models from https://github.com/rhasspy/piper/releases

# ── Whisper STT ───────────────────────────────────────────────────────────────
WHISPER_MODEL=base
# Model size. Options: tiny | base | small | medium | large
# tiny  → fastest, least accurate  (~75 MB)
# base  → good balance             (~145 MB)
# small → better accuracy          (~460 MB)
# medium → high accuracy           (~1.5 GB)
# large  → best accuracy           (~3 GB)
# Whisper downloads the model automatically on first use.
```

> **Never commit `.env` to Git.** It contains API keys. Make sure `.env` is in your `.gitignore`.

---

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/HeritageSentinel.git
cd HeritageSentinalWebsite

# Install Node dependencies
npm install
```

---

## Running Locally (Development)

You need two terminals — one for the backend, one for the Vite frontend.

**Terminal 1 — Start Ollama:**
```bash
ollama serve
```

**Terminal 2 — Backend (Express + Socket.IO):**
```bash
npm start
# Runs at http://localhost:3000
```

**Terminal 3 — Frontend (Vite dev server):**
```bash
npm run dev
# Runs at http://localhost:5173
```

Open `http://localhost:5173` in your browser. Vite proxies `/api` and `/socket.io` to port 3000 automatically.

---

## Running on a Local Network (LAN Access)

To open the app on any device on the same Wi-Fi (phones, tablets, other computers):

**Step 1 — Find your machine's local IP:**
```bash
# Windows
ipconfig

# macOS / Linux
hostname -I
```

**Step 2 — Start Ollama and the backend as normal.**

**Step 3 — Start Vite with the `--host` flag:**
```bash
npm run dev -- --host
```

Vite will print two URLs:
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.42:5173/
```

Share the **Network** URL with any device on the same network.

> Make sure your firewall allows inbound connections on ports `3000` and `5173`.

---

## Building for Production

```bash
# Build the React frontend into ./dist
npm run build

# Serve everything through Express on a single port
npm start
# Visit http://localhost:3000 or http://<your-ip>:3000
```

The Express server serves the `dist` folder as static files after a build, so the entire app runs on port `3000` only.

---

## AI Backend — Ollama

MUSE uses a locally running LLM via Ollama. If Ollama is unavailable, the server automatically falls back to the Groq cloud API.

**Install Ollama:**
```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows: download installer from https://ollama.com
```

**Pull a model:**
```bash
ollama pull llama3
# or a lighter model for slower machines:
ollama pull llama3:8b
ollama pull mistral
```

**Start the server:**
```bash
ollama serve
# Runs at http://localhost:11434
```

Ollama must be running before you start `npm start`. The `OPENCLAW_URL` in `.env` points to it.

---

## Piper TTS — Setup & Configuration

Piper handles all of MUSE's voice output server-side. The client calls `/api/tts`, the server runs Piper and streams back a `.wav` file. If Piper fails or is not installed, the browser falls back to the Web Speech API automatically.

### Where paths are defined in the code

In `server.js` lines 50–51 (fallback defaults if `.env` is not set):
```js
const PIPER_EXE        = process.env.PIPER_EXE        || 'C:\\piper\\piper.exe'
const PIPER_MODEL_PATH = process.env.PIPER_MODEL_PATH || 'C:\\piper\\models\\en_US-lessac-medium.onnx'
```

And lines 657–664 for per-language models:
```js
const TTS_MODELS = {
  'en': process.env.PIPER_MODEL_EN || PIPER_MODEL_PATH,
  'hi': process.env.PIPER_MODEL_HI || 'C:\\piper\\models\\hi_IN-priyamvada-medium.onnx',
  // ...
}
```

**Always set paths via `.env` — never edit `server.js` directly.** This way your paths are machine-specific and not committed to Git.

### Install Piper

**Windows:**
```
1. Download the latest release from https://github.com/rhasspy/piper/releases
   Get: piper_windows_amd64.zip
2. Extract to C:\piper\
3. You should have: C:\piper\piper.exe
```

**Linux / Raspberry Pi:**
```bash
# Download the Linux release
wget https://github.com/rhasspy/piper/releases/latest/download/piper_linux_aarch64.tar.gz
# For Pi (ARM64) — use aarch64
# For x86 Linux  — use amd64

tar -xzf piper_linux_aarch64.tar.gz
sudo mv piper /usr/local/bin/piper
piper --help   # verify
```

**macOS:**
```bash
# Download piper_macos_x64.tar.gz from the releases page
tar -xzf piper_macos_x64.tar.gz
sudo mv piper /usr/local/bin/piper
```

### Download voice models

Models are `.onnx` files downloaded separately from the executable.

```
Download from: https://github.com/rhasspy/piper/releases
Look for model files like: en_US-lessac-medium.onnx
```

Each model comes with a `.onnx` file and a `.onnx.json` config file — **you need both** in the same folder.

Recommended folder structure:
```
C:\piper\               (Windows)
/home/pi/piper/         (Linux / Pi)
├── piper.exe / piper
└── models/
    ├── en_US-lessac-medium.onnx
    ├── en_US-lessac-medium.onnx.json
    ├── hi_IN-priyamvada-medium.onnx
    ├── hi_IN-priyamvada-medium.onnx.json
    └── ...
```

Then update `.env` to point to wherever you put them on the new machine:
```env
PIPER_EXE=/home/pi/piper/piper
PIPER_MODEL_PATH=/home/pi/piper/models/en_US-lessac-medium.onnx
```

### Test Piper manually

```bash
# Windows
echo "Hello from Heritage Sentinel" | C:\piper\piper.exe --model C:\piper\models\en_US-lessac-medium.onnx --output_file test.wav

# Linux / Pi
echo "Hello from Heritage Sentinel" | piper --model ~/piper/models/en_US-lessac-medium.onnx --output_file test.wav
aplay test.wav
```

If this produces audio, Piper is working and the server will use it correctly.

---

## Whisper STT — Setup & Configuration

Whisper handles voice-to-text. The voice pipeline in `server.js` is:

```
Browser mic → WebSocket → .webm audio blob
  → ffmpeg converts to .wav (16kHz mono)
    → python -m whisper transcribes to .txt
      → /api/ask sends text to Ollama/Groq
        → response → Piper speaks it back
```

### Where it is defined in the code

`server.js` line 52:
```js
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'base'
```

`server.js` line 748 — the actual command:
```js
python -m whisper "${wavPath}" --model ${WHISPER_MODEL} --language ${whisperLang} --output_format txt --output_dir "..."
```

Whisper runs as a **Python module**, so it uses whatever `python` is on your system PATH. There is no executable path to configure — just install the package and make sure `python` works in your terminal.

### Install Whisper

```bash
pip install openai-whisper

# Verify it works
python -m whisper --help
```

On first use, Whisper downloads the model file automatically to `~/.cache/whisper/`. The download size depends on `WHISPER_MODEL` in `.env`:

| Model | Size | Speed | Accuracy |
|---|---|---|---|
| `tiny` | ~75 MB | Fastest | Low |
| `base` | ~145 MB | Fast | OK (default) |
| `small` | ~460 MB | Moderate | Good |
| `medium` | ~1.5 GB | Slow | Great |
| `large` | ~3 GB | Slowest | Best |

For a museum kiosk on a mid-range laptop, `base` or `small` is the best balance. On a powerful machine, use `medium`.

### ffmpeg is required

Whisper itself does not convert audio formats. The server uses ffmpeg to convert the browser's `.webm` recording into the `.wav` format Whisper expects. If ffmpeg is not installed and on PATH, voice input will silently fail. See [External Tools](#external-tools--install-on-every-machine) for install instructions.

### Test Whisper manually

```bash
# Record a short WAV file first (or use any WAV)
python -m whisper test.wav --model base --language en --output_format txt
# Should produce a test.txt file with the transcription
```

---

## Changing Machines — Full Checklist

Every time you move the project to a new computer, go through this list in order. Missing any one item is enough to break a specific feature.

### Install (once per machine)

```
□ Node.js v18+          → nodejs.org
□ Python 3.8+           → python.org  (tick "Add to PATH" on Windows)
□ ffmpeg                → ffmpeg.org  (add bin/ folder to system PATH)
□ Ollama                → ollama.com
□ Piper executable      → github.com/rhasspy/piper/releases
□ Piper .onnx models    → same releases page (one per language you use)
□ Whisper Python pkg    → pip install openai-whisper
```

### Configure (update .env for the new machine)

```
□ PIPER_EXE             → full path to piper.exe / piper on this machine
□ PIPER_MODEL_PATH      → full path to the English .onnx model
□ PIPER_MODEL_HI / FR / etc → paths for any other language models
□ WHISPER_MODEL         → tiny / base / small / medium / large (pick for this machine's speed)
□ OPENCLAW_URL          → http://localhost:11434/... (change if Ollama is on another machine)
□ PORT                  → 3000 (change only if that port is taken)
□ GROQ_API_KEY          → your Groq API key (needed if Ollama is not running)
□ VITE_FIREBASE_*       → copy from Firebase Console (same for all machines, same project)
□ BLYNK_TOKEN / PIN     → from your Blynk dashboard (same for all machines)
□ DEV_CODE              → admin password for the Settings page
```

### Run after moving

```bash
# 1. Install Node dependencies
npm install

# 2. Pull a model into Ollama (if not already done on this machine)
ollama pull llama3

# 3. Start Ollama
ollama serve

# 4. Start the backend
npm start

# 5. Start the frontend (dev)
npm run dev
# or for production:
npm run build && npm start

# 6. Test TTS manually
echo "test" | piper --model /path/to/model.onnx --output_file test.wav

# 7. Test Whisper manually
python -m whisper test.wav --model base --language en --output_format txt
```

### What breaks if something is missing

| Missing | What breaks |
|---|---|
| `ffmpeg` not on PATH | Voice input completely non-functional — no error shown to user |
| `piper` not found or wrong `PIPER_EXE` | MUSE goes silent — falls back to browser TTS (lower quality) |
| Wrong `.onnx` path | Same as above — Piper crashes, browser TTS takes over |
| Whisper not installed | Voice-to-text fails — mic button records but nothing is transcribed |
| Ollama not running | MUSE uses Groq fallback — if `GROQ_API_KEY` is also missing, AI fails entirely |
| Wrong `VITE_FIREBASE_*` | App loads but Firestore is unreachable — no robots, no artifacts shown |
| `BLYNK_TOKEN` missing | Robot movement commands are skipped silently |

---

## Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com) and create a project.
2. Enable **Firestore Database** and **Storage**.
3. Register a web app and copy the config values into `.env` under `VITE_FIREBASE_*`.
4. Deploy Firestore rules:
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules
```

---

## Features Overview

| Feature | Description |
|---|---|
| **MUSE AI Assistant** | Voice + text museum guide powered by local LLM (Ollama) or Groq fallback |
| **Piper TTS** | Server-side voice synthesis — streams WAV back to the browser |
| **Whisper STT** | Server-side voice transcription via Python — language auto-detected from UI |
| **Robot Fleet Monitor** | Live status, battery, and position of museum robots via Firestore |
| **Artifact Browser** | Search and view museum artifact collection stored in Firestore |
| **Interactive Map** | Visual museum floor plan with pathfinding |
| **Multilingual Support** | Language switching with per-language Piper voice models |
| **Voice Input** | Browser mic → WebSocket → ffmpeg → Whisper → MUSE |
| **Blynk Integration** | Sends movement commands to robots via Blynk IoT |
| **Real-time Updates** | Socket.IO for live robot and artifact events |
| **Admin Settings** | Protected settings page for museum staff (DEV_CODE) |
| **Browser TTS Fallback** | If Piper is unavailable, Web Speech API is used automatically |
