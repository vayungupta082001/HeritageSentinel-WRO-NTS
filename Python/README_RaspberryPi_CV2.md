# Heritage Sentinel — Raspberry Pi Vision Modules

Python computer vision scripts designed to run on a **Raspberry Pi** as part of the Heritage Sentinel museum robot system. There are two modules:

1. **Person Detection** — uses a TFLite MobileNet SSD model to detect people in real time via the Pi's camera.
2. **ArUco Marker Suite** — camera calibration, ArUco tag generation, detection, and 6DoF pose estimation for robot localisation inside the museum.

---

## Table of Contents

1. [Requirements](#1-requirements)
2. [SSH into the Raspberry Pi](#2-ssh-into-the-raspberry-pi)
3. [Essential Navigation & File Commands](#3-essential-navigation--file-commands)
4. [System Stats & Health Monitoring](#4-system-stats--health-monitoring)
5. [Temperature Monitoring](#5-temperature-monitoring)
6. [Checking Audio & Video Devices](#6-checking-audio--video-devices)
7. [Display & DISPLAY Variable Issues](#7-display--display-variable-issues)
8. [System Setup on the Pi](#8-system-setup-on-the-pi)
9. [Transferring Files to the Pi](#9-transferring-files-to-the-pi)
10. [Installing Python Dependencies](#10-installing-python-dependencies)
11. [Module 1 — Person Detection](#11-module-1--person-detection)
12. [Module 2 — ArUco Marker Suite](#12-module-2--aruco-marker-suite)
13. [Opening Chromium via SSH — HTTP Security Bypass](#13-opening-chromium-via-ssh--http-security-bypass)
14. [Running Scripts Headlessly](#14-running-scripts-headlessly)
15. [Auto-start on Boot](#15-auto-start-on-boot)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Requirements

- Raspberry Pi 4 (recommended) or Pi 3B+ running **Raspberry Pi OS (64-bit)**
- Pi Camera Module v2 / v3, or any USB webcam
- USB microphone and speaker, or a USB audio adapter
- Python 3.9 or later
- SSH access enabled on the Pi
- The host machine (your laptop/desktop) on the same local network as the Pi

---

## 2. SSH into the Raspberry Pi

This is always your first step. Everything else in this guide is done over SSH.

### Enable SSH on the Pi

On the Pi directly:
```bash
sudo raspi-config
# Navigate to: Interface Options → SSH → Enable
```

For headless first boot (no monitor): place an empty file named `ssh` with no extension into the boot partition of the SD card before inserting it.

### Find the Pi's IP address

On the Pi itself:
```bash
hostname -I
```

Or from your router's admin panel — look for a device named `raspberrypi`.

### Connect from your computer

```bash
ssh pi@<raspberry-pi-ip>
# Example:
ssh pi@192.168.1.50
```

Default credentials: username `pi`, password `raspberry`. **Change it immediately:**
```bash
passwd
```

### Passwordless SSH (recommended for daily use)

```bash
# On your computer — generate a key if you don't have one
ssh-keygen -t ed25519

# Push it to the Pi
ssh-copy-id pi@192.168.1.50

# Now you can connect without typing a password
ssh pi@192.168.1.50
```

### Useful SSH flags

```bash
# Forward GUI windows from the Pi to your screen (X11 forwarding)
ssh -X pi@192.168.1.50

# Trusted X11 forwarding — fewer permission errors, use if -X has issues
ssh -Y pi@192.168.1.50

# Run a single command over SSH without an interactive session
ssh pi@192.168.1.50 "vcgencmd measure_temp"

# Keep the connection alive (prevents timeouts on idle sessions)
ssh -o ServerAliveInterval=60 pi@192.168.1.50
```

---

## 3. Essential Navigation & File Commands

These are the commands you'll use every single session.

```bash
# Where am I?
pwd

# List files
ls
ls -la          # detailed, including hidden files
ls -lh          # human-readable sizes

# Change directory
cd ~/heritage-cv        # go to project folder
cd ..                   # up one level
cd ~                    # home directory (/home/pi)
cd -                    # jump back to previous directory

# Create directories
mkdir my_folder
mkdir -p a/b/c          # nested folders in one command

# Copy, move, delete
cp file.py backup.py
cp -r folder/ backup/   # copy entire folder
mv old.py new.py        # rename or move
rm file.py              # delete file
rm -rf folder/          # delete folder recursively (no undo — be careful)

# View files
cat file.py             # print entire file
head -30 file.py        # first 30 lines
tail -30 file.py        # last 30 lines
tail -f /var/log/syslog # follow a log file live (Ctrl+C to stop)
nano file.py            # edit a file in terminal

# Search
find ~ -name "PersonDetectionPi.py"     # find a file by name
grep -r "import cv2" ~/heritage-cv/     # search inside files

# Disk usage
df -h                           # free space on all partitions
du -sh ~/heritage-cv/           # size of a specific folder

# Process management
ps aux | grep python            # find running python processes
kill <PID>                      # stop a process by its ID
killall python3                 # stop all python3 processes

# Run in the background — survives SSH disconnect
nohup python3 PersonDetectionPi.py &> detection.log &
tail -f detection.log           # follow its output
```

---

## 4. System Stats & Health Monitoring

```bash
# Live CPU + memory + process view (like Task Manager)
top
htop                            # nicer version — install: sudo apt install htop

# Memory
free -h

# CPU info
cat /proc/cpuinfo | grep "Model"
nproc                           # number of cores

# Uptime and load
uptime

# Storage
df -h
lsblk                           # all block devices (SD card, USB drives)

# Network
ip addr show                    # all interfaces and their IPs
hostname -I                     # just the IP address(es)
ping google.com                 # test internet
iwconfig                        # Wi-Fi info (SSID, signal strength)

# Running services
sudo systemctl list-units --type=service --state=running

# OS and kernel info
uname -a
cat /etc/os-release

# Throttling check (run this if things feel slow)
vcgencmd get_throttled
# 0x0 = all good. Anything else = heat or power issue
```

> **Throttle bitmask explained:** bit 0 = currently under-voltage, bit 2 = currently throttled, bit 16 = under-voltage has occurred, bit 18 = throttling has occurred since last reboot. Run `echo $((16#$(vcgencmd get_throttled | cut -d= -f2)))` to get the decimal value.

---

## 5. Temperature Monitoring

The Pi throttles its CPU when it overheats. Monitor this closely when running ML inference.

```bash
# Current temperature
vcgencmd measure_temp
# Output: temp=52.1'C

# Watch temperature live every 2 seconds
watch -n 2 vcgencmd measure_temp

# Monitor temperature and throttle status together
watch -n 2 'vcgencmd measure_temp && vcgencmd get_throttled'

# CPU clock speed (will drop when throttling)
vcgencmd measure_clock arm

# Voltage readings
vcgencmd measure_volts core
vcgencmd measure_volts sdram_c
```

**Safe temperature ranges:**

| Range | Status |
|---|---|
| Below 70°C | ✅ Normal |
| 70°C – 80°C | ⚠️ Warm — consider heatsink or fan |
| 80°C – 85°C | 🔴 Hot — throttling begins |
| Above 85°C | 🔴 Critical — aggressive throttling |

---

## 6. Checking Audio & Video Devices

### Camera

```bash
# List all video devices
v4l2-ctl --list-devices

# Capabilities of a specific camera
v4l2-ctl -d /dev/video0 --all

# Supported resolutions and formats
v4l2-ctl -d /dev/video0 --list-formats-ext

# Quick test — capture one frame (no display needed)
sudo apt install -y fswebcam
fswebcam -d /dev/video0 -r 640x480 test_frame.jpg

# Pi Camera Module (libcamera)
libcamera-hello --list-cameras
libcamera-still -o test.jpg             # capture still image
libcamera-vid -t 5000 -o test.h264      # record 5 seconds
```

### Microphone (Audio Input)

```bash
# List all capture devices (microphones)
arecord -l

# Record 5 seconds and play it back
arecord -d 5 -f cd -t wav test_mic.wav
aplay test_mic.wav

# PulseAudio sources (microphones)
pactl list sources short

# Interactive volume/device mixer
alsamixer                       # F6 to switch device, arrow keys to adjust
```

### Speaker (Audio Output)

```bash
# List all playback devices
aplay -l

# PulseAudio sinks (speakers)
pactl list sinks short

# Test speaker with a tone
speaker-test -t sine -f 440 -c 2

# Play a test WAV
aplay /usr/share/sounds/alsa/Front_Left.wav

# Set volume
amixer set Master 80%
pactl set-sink-volume @DEFAULT_SINK@ 80%

# Mute / unmute
pactl set-sink-mute @DEFAULT_SINK@ toggle

# Force audio to 3.5mm jack (not HDMI)
amixer cset numid=3 1           # 1 = jack, 2 = HDMI, 0 = auto

# Check which audio card is active
cat /proc/asound/cards
```

### USB Devices

```bash
# List all connected USB devices
lsusb

# Watch for plug/unplug events live
sudo udevadm monitor --environment --udev | grep -i usb

# Set default PulseAudio input/output to a USB device
pactl set-default-source alsa_input.usb-<device_name>
pactl set-default-sink alsa_output.usb-<device_name>
# Get device names with: pactl list sources short / pactl list sinks short
```

---

## 7. Display & DISPLAY Variable Issues

GUI apps like OpenCV's `imshow` and Chromium need a display target. When SSHing in, the `DISPLAY` variable is usually not set, causing errors like:

```
cannot connect to X server
No protocol specified
qt.qpa.xcb: could not connect to display
```

### Check and set the DISPLAY variable

```bash
# Check if it's set
echo $DISPLAY
# Should be :0 when a monitor is connected. Blank = not set.

# Set it for the current session
export DISPLAY=:0

# Set it permanently (add to ~/.bashrc)
echo "export DISPLAY=:0" >> ~/.bashrc
source ~/.bashrc

# Allow the SSH session to open windows on the Pi's screen
export DISPLAY=:0
xhost +local:
```

### Pi has a monitor connected

```bash
# Verify X server is running
ps aux | grep Xorg

# Check connected monitors and resolutions
DISPLAY=:0 xrandr

# Check if display is reachable
xdpyinfo -display :0 2>/dev/null && echo "Display :0 is UP" || echo "Display :0 is DOWN"
```

### Pi has NO monitor (headless)

```bash
# Option A — Virtual display with Xvfb (software renderer)
sudo apt install -y xvfb
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99
python3 PersonDetectionPi.py

# Option B — X11 forwarding (window opens on YOUR computer)
# From your computer:
ssh -X pi@192.168.1.50
# Then on the Pi, just run the script normally
python3 PersonDetectionPi.py
```

### HDMI monitor not detected on boot

```bash
sudo nano /boot/config.txt
# Add or uncomment these lines:
# hdmi_force_hotplug=1
# hdmi_drive=2
# Save and reboot: sudo reboot
```

---

## 8. System Setup on the Pi

After SSHing in for the first time, update and install all required system packages:

```bash
sudo apt update && sudo apt upgrade -y

# Core dependencies for OpenCV and camera support
sudo apt install -y \
    python3-pip \
    python3-venv \
    python3-opencv \
    libatlas-base-dev \
    libhdf5-dev \
    libhdf5-serial-dev \
    v4l-utils \
    fswebcam \
    xvfb \
    chromium-browser \
    pulseaudio \
    alsa-utils

# Verify camera is detected
libcamera-hello --list-cameras  # Pi Camera
v4l2-ctl --list-devices         # USB webcam
```

---

## 9. Transferring Files to the Pi

From your computer, use `scp` to copy files:

```bash
# Copy entire project folder to the Pi
scp -r "Cv2 files/" pi@192.168.1.50:~/heritage-cv/

# Copy a single file
scp PersonDetectionPi.py pi@192.168.1.50:~/heritage-cv/

# rsync — smarter, only sends changed files (faster for repeat transfers)
rsync -avz --progress "Cv2 files/" pi@192.168.1.50:~/heritage-cv/
```

---

## 10. Installing Python Dependencies

On the Pi (inside the SSH session):

```bash
cd ~/heritage-cv

# Create a virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install all required packages
pip install \
    opencv-contrib-python \
    numpy \
    tflite-runtime

# If tflite-runtime fails on your Pi OS version:
# pip install tensorflow
```

> `opencv-contrib-python` is required — the base `opencv-python` does not include the `cv2.aruco` module.

To deactivate the virtual environment when done:
```bash
deactivate
```

---

## 11. Module 1 — Person Detection

**File:** `PersonDetectionPi.py`

Detects people in real time using a MobileNet SSD v1 TFLite model. Downloads the model automatically on first run. Draws bounding boxes, confidence scores, person count, FPS, and horizontal centre offset — used for the robot to track and follow visitors.

### Run

```bash
cd ~/heritage-cv
source venv/bin/activate
python3 PersonDetectionPi.py
```

### What it does

- Downloads `detect.tflite` to `~/detect.tflite` on first run (~7 MB)
- Auto-scans `/dev/video0` through `/dev/video3` for a camera
- Runs inference every 3 frames for better Pi performance
- Press **Q** to quit

### Tunable constants (top of file)

| Constant | Default | Description |
|---|---|---|
| `CONFIDENCE` | `0.5` | Minimum detection score (0.0–1.0) |
| `DETECT_EVERY_N` | `3` | Inference every N frames |
| `FRAME_W / FRAME_H` | `640 / 480` | Camera resolution |

---

## 12. Module 2 — ArUco Marker Suite

**Folder:** `ArUCo-Markers-Pose-Estimation-Generation-Python-main/`

Workflow: **calibrate camera → generate tags → detect tags → estimate pose**

```bash
cd ~/heritage-cv/ArUCo-Markers-Pose-Estimation-Generation-Python-main
source ../venv/bin/activate
```

### Camera Calibration

Print a checkerboard, photograph it from multiple angles, save into `calibration_checkerboard/`, then run:

```bash
python3 calibration.py \
    --dir calibration_checkerboard/ \
    --square_size 0.024
# --square_size = physical size of one square in metres (0.024 = 24 mm)
```

Outputs `calibration_matrix.npy` and `distortion_coefficients.npy`. Keep these — required for pose estimation.

### Generate ArUco Tags

```bash
python3 generate_aruco_tags.py
# Output PNGs saved to tags/
```

Print and place these around the museum. `DICT_5X5_100` supports up to 100 unique markers.

### Detect Tags in an Image

```bash
python3 detect_aruco_images.py \
    --image Images/test_image_1.png \
    --type DICT_5X5_100
```

### Detect Tags via Live Camera

```bash
python3 detect_aruco_video.py --type DICT_5X5_100
# Press Q to quit
```

### Pose Estimation (Live Camera)

```bash
python3 pose_estimation.py \
    --K_Matrix calibration_matrix.npy \
    --D_Coeff distortion_coefficients.npy \
    --type DICT_5X5_100
# Press Q to quit
```

Draws a 3D axis on each detected tag, giving the robot its exact position and orientation in the museum.

---

## 13. Opening Chromium via SSH — HTTP Security Bypass

The Heritage Sentinel web interface runs over plain HTTP (`http://192.168.x.x:3000`). Chromium blocks camera, microphone, and certain features on non-HTTPS origins by default. This section covers how to fully bypass those restrictions over SSH.

### Why the problem exists

Chromium enforces a **Secure Context** policy — features like `getUserMedia()` (camera/mic), autoplay audio, and WebRTC are only allowed on:
- `https://` origins, or
- `localhost` / `127.0.0.1`

Since the Heritage Sentinel server is accessed by IP over HTTP (e.g. `http://192.168.1.42:3000`), Chromium treats it as insecure and blocks those APIs by default.

### Option A — Flag the IP as a Secure Origin (Recommended)

This tells Chromium to treat a specific HTTP address as if it were HTTPS, without any actual certificate:

```bash
export DISPLAY=:0
xhost +local:

chromium-browser \
  --no-sandbox \
  --disable-dev-shm-usage \
  --unsafely-treat-insecure-origin-as-secure="http://192.168.1.42:3000" \
  --allow-running-insecure-content \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream \
  http://192.168.1.42:3000 &
```

> `--unsafely-treat-insecure-origin-as-secure` is the key flag. It grants the target HTTP URL full secure-context privileges — camera, mic, autoplay, WebRTC all work.

### Option B — Enable the Flag via chrome://flags (GUI)

If you have a display attached:

1. Open Chromium and go to `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
2. Enable it and paste `http://192.168.1.42:3000` in the text field
3. Click **Relaunch**

This persists across restarts and does not need command-line flags.

### Option C — Chromium Policy File (Best for Kiosk / Auto-start)

Applies permissions permanently at the system level, no flags needed at launch:

```bash
sudo mkdir -p /etc/chromium/policies/managed
sudo nano /etc/chromium/policies/managed/heritage.json
```

Paste:
```json
{
  "VideoCaptureAllowed": true,
  "AudioCaptureAllowed": true,
  "VideoCaptureAllowedUrls": ["http://192.168.1.42:3000"],
  "AudioCaptureAllowedUrls": ["http://192.168.1.42:3000"],
  "AutoplayAllowed": true,
  "AutoplayAllowlist": ["http://192.168.1.42:3000"],
  "InsecureContentAllowedForUrls": ["http://192.168.1.42:3000"]
}
```

Save, then launch Chromium normally — all permissions are auto-granted, no popups.

### Option D — Self-signed HTTPS Certificate (Proper Fix)

If you want Chromium to behave correctly without any workaround flags, serve the app over HTTPS with a self-signed cert. On the machine running the Node.js server:

```bash
# Generate a self-signed cert (valid for 365 days)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj "/CN=192.168.1.42" \
  -addext "subjectAltName=IP:192.168.1.42"
```

Then update `server.js` to use HTTPS:
```js
const https = require('https');
const fs = require('fs');

const server = https.createServer({
  key:  fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem'),
}, app);
```

On the Pi, visit `https://192.168.1.42:3000` and accept the self-signed certificate warning once. After that, camera, mic, and all secure-context features work natively without any Chromium flags.

### Full Kiosk Launch Command (combining all fixes)

```bash
export DISPLAY=:0
xhost +local:

chromium-browser \
  --kiosk \
  --no-sandbox \
  --disable-dev-shm-usage \
  --unsafely-treat-insecure-origin-as-secure="http://192.168.1.42:3000" \
  --allow-running-insecure-content \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream \
  --enable-features=WebRTC \
  --disable-features=WebRtcHideLocalIpsWithMdns \
  http://192.168.1.42:3000 &
```

### Verify audio is going to the right device

```bash
# See what Chromium is playing through
pactl list sink-inputs

# Change output device
pactl set-default-sink <sink_name>
# Get names: pactl list sinks short

# Set volume
pactl set-sink-volume @DEFAULT_SINK@ 80%

# Mute / unmute
pactl set-sink-mute @DEFAULT_SINK@ toggle
```

### Auto-launch Chromium on desktop boot

```bash
mkdir -p ~/.config/autostart
nano ~/.config/autostart/heritage-kiosk.desktop
```

Paste:
```ini
[Desktop Entry]
Type=Application
Name=Heritage Sentinel Kiosk
Exec=chromium-browser --kiosk --no-sandbox --disable-dev-shm-usage --unsafely-treat-insecure-origin-as-secure="http://192.168.1.42:3000" --allow-running-insecure-content --autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream http://192.168.1.42:3000
X-GNOME-Autostart-enabled=true
```

---

## 14. Running Scripts Headlessly

When the Pi has no monitor, remove all `cv2.imshow()` / `cv2.waitKey()` calls and print detections to the terminal — this is the cleanest production approach.

If you need a display anyway (e.g. for debugging):

```bash
sudo apt install -y xvfb
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99
python3 PersonDetectionPi.py
```

Or use X11 forwarding to open the window on your own computer:
```bash
# From your computer:
ssh -X pi@192.168.1.50
# Then on the Pi:
python3 PersonDetectionPi.py
```

---

## 15. Auto-start on Boot

Use `systemd` to run the detection script automatically on boot:

```bash
sudo nano /etc/systemd/system/heritage-detection.service
```

Paste:
```ini
[Unit]
Description=Heritage Sentinel Person Detection
After=network.target

[Service]
ExecStart=/home/pi/heritage-cv/venv/bin/python3 /home/pi/heritage-cv/PersonDetectionPi.py
WorkingDirectory=/home/pi/heritage-cv
StandardOutput=journal
StandardError=journal
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

Enable and start it:
```bash
sudo systemctl daemon-reload
sudo systemctl enable heritage-detection
sudo systemctl start heritage-detection

# Check status and live logs
sudo systemctl status heritage-detection
journalctl -u heritage-detection -f
```

Other useful service commands:
```bash
sudo systemctl stop heritage-detection
sudo systemctl restart heritage-detection
sudo systemctl disable heritage-detection   # stop it from running on boot
```

---

## 16. Troubleshooting

**Camera not found:**
```bash
v4l2-ctl --list-devices
libcamera-hello
fswebcam -d /dev/video0 test.jpg
```

**`cv2.aruco` not found:**
```bash
pip uninstall opencv-python
pip install opencv-contrib-python
```

**TFLite import error:**
```bash
pip install tflite-runtime
# If that fails:
pip install tensorflow
```

**`cannot connect to X server`:**
```bash
export DISPLAY=:0
xhost +local:
# If headless, use Xvfb or ssh -X
```

**Chromium blocks camera/mic on HTTP:**
```bash
# Add this flag when launching:
--unsafely-treat-insecure-origin-as-secure="http://192.168.1.42:3000"
# Or use the policy file method in Section 13.
```

**Low FPS on Pi:**
- Increase `DETECT_EVERY_N` (e.g. to `5` or `10`)
- Lower `FRAME_W / FRAME_H` (e.g. `320x240`)
- Check `vcgencmd get_throttled` — throttling kills performance

**SSH connection refused:**
```bash
sudo systemctl status ssh
sudo systemctl start ssh
sudo systemctl enable ssh
```

**Permission denied on camera:**
```bash
sudo usermod -aG video pi
# Log out and back in
```

**Audio not working in Chromium:**
```bash
pactl list sinks short
pactl set-default-sink <correct_sink_name>
pactl set-sink-volume @DEFAULT_SINK@ 80%
```
