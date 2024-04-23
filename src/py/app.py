from typing import Annotated
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile

from src.py.speech import speech_to_text

# https://python.plainenglish.io/managing-api-keys-and-secrets-in-python-using-the-dotenv-library-a-beginners-guide-33890401cd15
load_dotenv()

app = FastAPI()

@app.get("/")
def index() -> str:
    return "API online"

@app.post("/chat/")
def chat(
    recording: Annotated[bytes, File()],
    recordingb: Annotated[UploadFile, File()]
    ) -> str:
    request = speech_to_text(recording)
    
    print(f"Request: {request}")
    
    return request