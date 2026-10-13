import os
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from transformers import pipeline


MODEL_ID = "IbrahimAmin/code-switched-egyptian-arabic-whisper-small"
DEVICE = int(os.getenv("ASR_DEVICE", "-1"))

app = FastAPI(title="Care Circle Arabic ASR")
recognizer = pipeline(
    "automatic-speech-recognition",
    model=MODEL_ID,
    device=DEVICE,
)


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_ID}


@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    suffix = Path(audio.filename or "audio.wav").suffix or ".wav"
    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(await audio.read())
            temp_path = temp_file.name

        result = recognizer(temp_path)
        return {"transcript": result["text"]}
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
