from typing import Annotated
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import ssl

from pydantic_core import from_json

from src.py.chat import ChatResponse, Conversation, Message, chat_response
from src.py.speech import speech_to_text, text_to_speech

# https://python.plainenglish.io/managing-api-keys-and-secrets-in-python-using-the-dotenv-library-a-beginners-guide-33890401cd15
load_dotenv()

app = FastAPI()

# https://fastapi.tiangolo.com/tutorial/cors/
app.add_middleware(
    CORSMiddleware,
    allow_origins=['https://localhost:3001/'],
    # allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# https://medium.com/@mariovanrooij/adding-https-to-fastapi-ad5e0f9e084e
ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ssl_context.load_cert_chain('./certificates/localhost.pem', keyfile='./certificates/localhost-key.pem')

@app.get("/")
def index() -> str:
    return "API online"

@app.post("/sst/")
def sst(
        audio: Annotated[bytes, File()],
        response: Response,
    ) -> str:
    response.headers.append("Access-Control-Allow-Origin", "*")
    
    return speech_to_text(audio)

@app.post("/chat/")
def chat(
    conversation: Annotated[str, Form()],
    response: Response,
    ) -> ChatResponse:
    conversation_parsed = from_json(conversation)
    conversation_obj = Conversation.model_construct(**conversation_parsed)
    
    response.headers.append("Access-Control-Allow-Origin", "*")
    
    return chat_response(conversation_obj)

@app.get("/tts")
def tts(
        ssml: str,
    ):
    response = Response(content=text_to_speech(ssml), media_type="audio/ogg")
    response.headers.append("Access-Control-Allow-Origin", "*")
    return response