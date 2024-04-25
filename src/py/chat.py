from enum import Enum
from openai import OpenAI
from pydantic import BaseModel

client = OpenAI()

# https://platform.openai.com/docs/api-reference/chat/create?lang=python

class MsgPerson(Enum):
    user = "user"
    ai = "ai"

class Msg(BaseModel):
    person: MsgPerson
    content: str

def chat_response(messages: list[Msg]) -> str:
    messages_for_ai = [
        {"role": "system", "content": "You are a friendly chatbot."},
    ]
    
    for msg in messages:
        messages_for_ai.append({
            "role": "user" if msg.person == MsgPerson.user else "assistant",
            "content": msg.content
        })
    
    completion = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=messages_for_ai
    )
    
    return completion.choices[0].message.content

def ssml(response: str) -> str:
    completion = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            { "role": "system", "content": "Generate SSML-formatted version of plaintext" },
            { "role": "user", "content": response }
        ]
    )
    
    return completion.choices[0].message.content