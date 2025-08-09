from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from murf import Murf
import os
from dotenv import load_dotenv
import assemblyai as aai
import google.generativeai as genai

# Load environment variables
load_dotenv()

# Initialize AssemblyAI
aai.settings.api_key = os.getenv("ASSEMBLYAI_API_KEY")

# Initialize Google Gemini
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

app = FastAPI(title="AI Voice Agent - Day 7", version="1.0.0")

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize Murf client
client = Murf(api_key=os.getenv("MURF_API_KEY"))

# Request models
class TTSRequest(BaseModel):
    text: str
    voice_id: str = "en-US-ken"
    style: str = "Conversational"

class LLMRequest(BaseModel):
    text: str
    model: str = "gemini-1.5-flash"
    max_tokens: int = 1000
    temperature: float = 0.7

# Serve homepage
@app.get("/", response_class=HTMLResponse)
async def get_home():
    with open("static/index.html", "r", encoding="utf-8") as file:
        return HTMLResponse(content=file.read())

# TTS endpoint
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

@app.post("/api/tts/echo")
async def tts_echo(file: UploadFile = File(...)):
    """
    Transcribe audio, generate new audio with Murf, and return the audio URL.
    """
    try:
        # 1. Transcribe the uploaded audio file
        audio_data = await file.read()
        transcriber = aai.Transcriber()
        transcript = transcriber.transcribe(audio_data)

        if transcript.status == aai.TranscriptStatus.error:
            raise HTTPException(status_code=500, detail=f"Transcription failed: {transcript.error}")

        transcribed_text = transcript.text
        if not transcribed_text or not transcribed_text.strip():
            # Return a successful response but with a note that no speech was generated
            return {
                "audio_url": None,
                "transcript": "(No speech detected)"
            }

        # 2. Generate new audio from the transcribed text using Murf
        murf_response = client.text_to_speech.generate(
            text=transcribed_text,
            voice_id="en-US-ken",  # Using a default voice
            style="Conversational"
        )

        # 3. Return the new audio URL and the transcript
        return {
            "audio_url": murf_response.audio_file,
            "transcript": transcribed_text
        }

    except Exception as e:
        # Catch any exception, including from Murf or AssemblyAI
        raise HTTPException(status_code=500, detail=f"Echo Bot failed: {str(e)}")

# New LLM Query endpoint
@app.post("/llm/query")
async def llm_query(request: LLMRequest):
    """
    Accept text input and generate a response using Google's Gemini API
    """
    try:
        model = genai.GenerativeModel(request.model)
        
        generation_config = genai.types.GenerationConfig(
            max_output_tokens=request.max_tokens,
            temperature=request.temperature
        )
        response = model.generate_content(
            request.text,
            generation_config=generation_config
        )
        if response.text:
            return {
                "response": response.text,
                "input": request.text,
                "model": request.model,
                "tokens_used": len(response.text.split()) if response.text else 0
            }
        else:
            raise HTTPException(status_code=500, detail="No response generated from LLM")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM query failed: {str(e)}")