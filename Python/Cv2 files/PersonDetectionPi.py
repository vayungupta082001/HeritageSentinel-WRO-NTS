import cv2
import numpy as np
import time
import os
import urllib.request
import zipfile
import io

try:
    import tflite_runtime.interpreter as tflite
except ImportError:
    import tensorflow as tf
    tflite = tf.lite

MODEL_URL = (
    "https://storage.googleapis.com/download.tensorflow.org/"
    "models/tflite/coco_ssd_mobilenet_v1_1.0_quant_2018_06_29.zip"
)
MODEL_FILE = os.path.expanduser("~/detect.tflite")
PERSON_CLASS_ID = 0
FRAME_W = 640
FRAME_H = 480
INPUT_SIZE = 300
CONFIDENCE = 0.5
DETECT_EVERY_N = 3

def download_model():
    if os.path.exists(MODEL_FILE):
        print("[INFO] Model already exists, skipping download")
        return
    print("[INFO] Downloading model...")
    with urllib.request.urlopen(MODEL_URL) as r:
        data = r.read()
    z = zipfile.ZipFile(io.BytesIO(data))
    for name in z.namelist():
        if name.endswith(".tflite"):
            with open(MODEL_FILE, "wb") as f:
                f.write(z.read(name))
            break
    print("[INFO] Model downloaded successfully")

def load_interpreter():
    interpreter = tflite.Interpreter(model_path=MODEL_FILE, num_threads=4)
    interpreter.allocate_tensors()
    return interpreter

def detect_persons(interpreter, input_details, output_details, frame):
    h, w = frame.shape[:2]
    img = cv2.resize(frame, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_AREA)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    input_data = np.expand_dims(img, axis=0).astype(np.uint8)
    interpreter.set_tensor(input_details[0]['index'], input_data)
    interpreter.invoke()
    boxes   = interpreter.get_tensor(output_details[0]['index'])[0]
    classes = interpreter.get_tensor(output_details[1]['index'])[0]
    scores  = interpreter.get_tensor(output_details[2]['index'])[0]
    try:
        count = int(interpreter.get_tensor(output_details[3]['index'])[0])
    except Exception:
        count = len(scores)
    detections = []
    for i in range(count):
        if scores[i] < CONFIDENCE:
            continue
        if int(classes[i]) != PERSON_CLASS_ID:
            continue
        ymin, xmin, ymax, xmax = boxes[i]
        x1 = int(xmin * w)
        y1 = int(ymin * h)
        x2 = int(xmax * w)
        y2 = int(ymax * h)
        detections.append((x1, y1, x2, y2, float(scores[i])))
    return detections

def draw(frame, detections, fps):
    h, w = frame.shape[:2]
    cx = w // 2
    for (x1, y1, x2, y2, conf) in detections:
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
        label = f"Person {conf:.0%}"
        cv2.putText(frame, label, (x1, max(y1 - 10, 10)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        person_cx = (x1 + x2) // 2
        person_cy = (y1 + y2) // 2
        cv2.circle(frame, (person_cx, person_cy), 5, (0, 0, 255), -1)
        offset = person_cx - cx
        cv2.putText(frame, f"Offset: {offset}", (x1, min(y2 + 20, h - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
        cv2.line(frame, (cx, person_cy), (person_cx, person_cy), (0, 0, 255), 2)
    cv2.line(frame, (cx, 0), (cx, h), (255, 0, 0), 1)
    cv2.putText(frame, f"FPS: {fps:.1f}", (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv2.putText(frame, f"Persons: {len(detections)}", (10, 55),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    return frame

def open_camera():
    for index in range(4):
        cap = cv2.VideoCapture(index, cv2.CAP_V4L2)
        if cap.isOpened():
            print(f"[INFO] Camera opened on /dev/video{index}")
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_W)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_H)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            return cap
        cap.release()
    for index in range(4):
        cap = cv2.VideoCapture(index)
        if cap.isOpened():
            print(f"[INFO] Camera opened on index {index} (no V4L2)")
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_W)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_H)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            return cap
        cap.release()
    return None

def main():
    download_model()
    interpreter = load_interpreter()
    input_details  = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    print("[INFO] Input details:", input_details)
    print("[INFO] Output details:", output_details)
    cap = open_camera()
    if cap is None:
        print("[ERROR] Could not open any camera.")
        return
    print("[INFO] Running TFLite person detector...")
    print("[INFO] Press Q to quit")
    frame_count = 0
    fps = 0.0
    t0 = time.time()
    last_dets = []
    while True:
        ret, frame = cap.read()
        if not ret:
            print("[WARN] Failed to grab frame, retrying...")
            time.sleep(0.1)
            continue
        frame_count += 1
        if frame_count % DETECT_EVERY_N == 0:
            try:
                last_dets = detect_persons(interpreter, input_details, output_details, frame)
            except Exception as e:
                print(f"[WARN] Detection error: {e}")
                last_dets = []
        if frame_count % 10 == 0:
            elapsed = time.time() - t0
            fps = 10 / elapsed if elapsed > 0 else 0
            t0 = time.time()
        frame = draw(frame, last_dets, fps)
        cv2.imshow("TFLite Person Detection", frame)
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Done.")

if __name__ == "__main__":
    main()