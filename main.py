from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from murf import Murf
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="AI Voice Agent - Day 2", version="1.0.0")

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize Murf client
client = Murf(api_key=os.getenv("MURF_API_KEY"))

# Request model
class TTSRequest(BaseModel):
    text: str
    voice_id: str = "en-US-ken"
    style: str = "Conversational"

# Serve homepage
@app.get("/", response_class=HTMLResponse)
async def get_home():
    with open("static/index.html", "r", encoding="utf-8") as file:
        return HTMLResponse(content=file.read())

# TTS endpoint - exactly what the task asks for
@app.post("/api/text-to-speech")
async def generate_speech(request: TTSRequest):
    """
    Create a server endpoint that accepts text and returns audio URL
    """
    try:
        # Call Murf's TTS API using SDK
        response = client.text_to_speech.generate(
            text=request.text,
            voice_id=request.voice_id,
            style=request.style
        )
        
        # Return URL pointing to the generated audio file
        return {
            "audio_url": response.audio_file,
            "text": request.text,
            "voice_id": request.voice_id,
            "style": request.style
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

# Health check
@app.get("/api/health")
async def health_check():
    return {
        "status": "AI Voice Agent Running!",
        "day": 2,
        "endpoint": "/api/text-to-speech",
        "murf_sdk": "Ready"
    }