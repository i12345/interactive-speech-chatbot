from typing import Annotated
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import ssl

from pydantic import BaseModel
from pydantic_core import from_json

from src.py.chat import Msg, MsgPerson, chat_response, ssml
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

class Conversation(BaseModel):
    messages: list[Msg]

class ChatResponse(BaseModel):
    transcribed_message: str
    response_chat: str
    response_chat_ssml: str

@app.post("/chat/")
def chat(
    audio: Annotated[bytes, File()],
    conversation: Annotated[str, Form()],
    response: Response,
    ) -> ChatResponse:
    transcribed_message = speech_to_text(audio)
    
    print(f"Request: {transcribed_message}")
    
    print(f"conversation: {conversation}")
    
    # https://docs.pydantic.dev/latest/concepts/json/
    Conversation.model_validate_json(conversation, strict=True)
    conversation_parsed = from_json(conversation)
    conversation = Conversation.model_construct(**conversation_parsed)
    
    messages = conversation.messages + [Msg(person=MsgPerson.user, content=transcribed_message)]
    
    response.headers.append("Access-Control-Allow-Origin", "*")
    
    response_chat = chat_response(messages=messages)
    print(f"Response: {response_chat}")
    
    response_chat_ssml = ssml(response_chat)
    print(f"SSML={response_chat_ssml}")
    
    return ChatResponse(
        transcribed_message=transcribed_message,
        response_chat=response_chat,
        response_chat_ssml=response_chat_ssml,
        # response_audio=response_audio
    )

# https://fastapi.tiangolo.com/advanced/custom-response/
@app.get("/tts")
def tts(
    ssml: str,
    response: Response,
    ):
    response.headers.append("Access-Control-Allow-Origin", "*")
    speech = text_to_speech(ssml)
    return Response(content=speech, media_type="audio/ogg")
