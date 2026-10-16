import os
import subprocess
import tempfile
import wave
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from imageio_ffmpeg import get_ffmpeg_exe
import numpy as np
from transformers import pipeline


MODEL_ID = "IbrahimAmin/code-switched-egyptian-arabic-whisper-small"
EMOTION_MODEL_ID = os.getenv("EMOTION_MODEL_ID", "superb/wav2vec2-base-superb-er")
DEVICE = int(os.getenv("ASR_DEVICE", "-1"))

app = FastAPI(title="Care Circle Arabic ASR")
recognizer = pipeline(
    "automatic-speech-recognition",
    model=MODEL_ID,
    device=DEVICE,
)
emotion_recognizer = None
try:
    emotion_recognizer = pipeline(
        "audio-classification",
        model=EMOTION_MODEL_ID,
        device=DEVICE,
    )
except Exception as error:
    print(f"Voice tone model unavailable; emotion estimates are disabled: {error}")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_ID,
        "emotion_model": EMOTION_MODEL_ID,
        "emotion_model_loaded": emotion_recognizer is not None,
    }


def classify_voice_tone(waveform: np.ndarray) -> dict[str, str | float]:
    if emotion_recognizer is None:
        return {"label": "uncertain", "confidence": 0.0}

    predictions = emotion_recognizer(
        {"raw": waveform, "sampling_rate": 16000}, top_k=1
    )
    prediction = predictions[0]
    label = prediction["label"].strip().lower()
    aliases = {
        "hap": "happy",
        "happiness": "happy",
        "neu": "neutral",
        "ang": "angry",
    }
    label = aliases.get(label, label)
    if label not in {"happy", "sad", "angry", "neutral"}:
        label = "uncertain"

    confidence = float(prediction["score"])
    return {"label": label, "confidence": confidence}


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    suffix = Path(audio.filename or "audio.wav").suffix or ".wav"
    temp_path = None
    wav_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(await audio.read())
            temp_path = temp_file.name

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as wav_file:
            wav_path = wav_file.name

        conversion = subprocess.run(
            [
                get_ffmpeg_exe(),
                "-nostdin",
                "-hide_banner",
                "-loglevel",
                "error",
                "-y",
                "-i",
                temp_path,
                "-ac",
                "1",
                "-ar",
                "16000",
                "-c:a",
                "pcm_s16le",
                wav_path,
            ],
            capture_output=True,
            text=True,
        )
        if conversion.returncode != 0:
            details = (
                conversion.stderr.strip()
                or conversion.stdout.strip()
                or f"FFmpeg exited with code {conversion.returncode}"
            )
            raise RuntimeError(f"Could not convert the recording to WAV: {details}")

        # Read the normalized PCM WAV directly. Passing the filename makes
        # Transformers use its optional audio-file loader (soundfile/torchaudio),
        # which can reject otherwise valid uploads on some Windows setups.
        with wave.open(wav_path, "rb") as wav_file:
            if wav_file.getnchannels() != 1 or wav_file.getframerate() != 16000:
                raise RuntimeError("FFmpeg output was not mono 16 kHz audio")
            samples = wav_file.readframes(wav_file.getnframes())
            waveform = np.frombuffer(samples, dtype=np.int16).astype(np.float32) / 32768.0

        if waveform.size == 0:
            raise RuntimeError("The recording contains no audio samples")

        transcript_result = recognizer({"raw": waveform, "sampling_rate": 16000})
        try:
            emotion = classify_voice_tone(waveform)
        except Exception as error:
            print(f"Voice tone inference failed: {error}")
            emotion = {"label": "uncertain", "confidence": 0.0}
        return {"transcript": transcript_result["text"], "emotion": emotion}
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    finally:
        for path in (temp_path, wav_path):
            if path and os.path.exists(path):
                os.remove(path)
