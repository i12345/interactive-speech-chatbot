from enum import Enum
from openai import OpenAI
from pydantic import BaseModel

class Message(BaseModel):
    role: str
    content: str

class Conversation(BaseModel):
    messages: list[Message]

class ChatResponse(BaseModel):
    ssml: str
    text: str

client = OpenAI()

def chat_response(conversation: Conversation) -> ChatResponse:
    response = client.chat.completions.create(
        model='gpt-3.5-turbo',
        messages=[Message(
            role="system",
            content="You are a friendly voice assistant"
        )] + conversation.messages
    )
    
    text = response.choices[0].message.content
    
    ssml = client.chat.completions.create(
        model='gpt-3.5-turbo',
        messages=[
            {
                "role": "system",
                "content": "You convert text response to SSML responses for speech synthesis with emotion (where appropriate). Please convert the following text into SSML"
            },
            {
                "role": "user",
                "content": text
            }
        ]
    ).choices[0].message.content
    
    return ChatResponse(text=text, ssml=ssml)



