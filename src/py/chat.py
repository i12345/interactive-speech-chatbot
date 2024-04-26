from abc import ABC, abstractmethod
from datetime import datetime
from enum import Enum
import os
from typing import Literal, Optional
from pydantic import BaseModel
from dspy.functional import cot, predictor
import dspy

import wolframalpha

from googleapiclient.discovery import build

dspy.configure(lm=dspy.OpenAI(model="gpt-3.5-turbo"))

class Message(BaseModel):
    role: str
    content: str

class Conversation(BaseModel):
    messages: list[Message]
    
class ExternalAction(Enum):
    none = "none"
    end_conversation = "end_conversation"

class ChatResponse(BaseModel):
    ssml: str
    text: str
    external_action: ExternalAction

class Run(BaseModel):
    internal_action_history: list["ActionSelection"] = []
    internal_thoughts: list[str] = []
    conversation: Conversation
    suggested_responses: list[ChatResponse]

class InternalAction(BaseModel, ABC):
    """An action that you can do"""
    name: str
    function: str
    when_to_run: str
    how_to_run: str
    notes: str
    
    @abstractmethod
    def act(self, arg: str, run: Run):
        pass

class ActionSelection(BaseModel):
    action_name: str
    arg: Optional[str]

@predictor
def text_to_ssml(text: str) -> str:
    """Generate SSML from text for speech synthesis. Only generate the SSML"""

class SuggestResponseAction(InternalAction):
    def __init__(self):
        super().__init__(
            name="Suggest response",
            function="Suggests a response to the user",
            when_to_run="When you think you have enough information or want to respond.",
            how_to_run="Put your suggested response in the action arg",
            notes="This action will add a suggested response to consider returning"
        )
        
    def act(self, arg: str, agent_run: Run):
        text = arg
        ssml = text_to_ssml(text=text)
        
        agent_run.suggested_responses.append(ChatResponse(text=text, ssml=ssml, external_action=ExternalAction.none))

class ThinkAction(InternalAction):
    def __init__(self):
        super().__init__(
            name="Think",
            function="Think internal thought",
            when_to_run="When you have a question or thought you want to record.",
            how_to_run="Put your thought in the action arg",
            notes="This will save the thought to short-term memory; it will only persist in current exchange"
        )
        
    def act(self, arg: str, agent_run: Run):
        thought = arg
        agent_run.internal_thoughts.append(thought)

# https://wolframalpha.readthedocs.io/en/latest/?badge=latest#wolframalpha.Client
wolframalpha_client = wolframalpha.Client(os.environ.get("WOLFRAM_ALPHA_APP_ID"))

class QueryWolframAlpha(InternalAction):
    def __init__(self):
        super().__init__(
            name="Query WolframAlpha",
            function="Queries WolframAlpha",
            when_to_run="When you are asked or have question about current events or something you don't know.",
            how_to_run="Put your query (natural language question or something to learn more about) in the action arg",
            notes="Results will be plaintext formatted"
        )
        
    def act(self, arg: str, agent_run: Run):
        query = arg
        res = wolframalpha_client.query(query)
        results = ""
        for pod in res.pods:
            for subpod in pod.subpods:
                if subpod.plaintext is not None:
                    results += subpod.plaintext + "\n"
        agent_run.internal_thoughts.append(f"WolframAlpha results for {query}\n\n{results}")

# https://github.com/googleapis/google-api-python-client/blob/main/samples/customsearch/main.py

search_google_service = build(
    "customsearch", "v1", developerKey=os.environ.get("GOOGLE_CUSTOM_SEARCH_API_KEY")
)

class SearchGoogleAction(InternalAction):
    def __init__(self):
        super().__init__(
            name="Search Google",
            function="Searches Google",
            when_to_run="When you are asked or have question about current events or something you don't know.",
            how_to_run="Put your query (natural language question or something to learn more about) in the action arg",
            notes="Results will be plaintext formatted"
        )
        
    def act(self, arg: str, agent_run: Run):
        res = (
            search_google_service.cse()
            .list(
                q=arg,
                cx="547adf6cd88134f04",
            )
            .execute()
        )
        
        limit = 5
        answer = f"Google search top {limit} results for {arg}\n"
        
        for item in res["items"]:
            limit -= 1
            if limit == 0:
                break
            answer += f"\n{item['title']} ({item['displayLink']})\n{item['snippet']}\n"
        agent_run.internal_thoughts.append(answer)

# @predictor
# def approve_response(run: Run) -> bool:
#     """Decide whether or not current_response_to_user is permitted. Return false if current_response_to_user appears made up when user was requesting factual information. Return true to approve this response to respond to the user with."""

# class ApproveResponseAction(InternalAction):
#     def __init__(self):
#         super().__init__(
#             name="Approve response",
#             function="Approves response to return to user",
#             when_to_run="When current_response_to_user is available",
#             how_to_run="Simply choose to run this action",
#             notes="This action will estimate whether current_response_to_user is accurate or made up"
#         )
        
#     def act(self, arg: str, run: Run):
#         if approve_response(run=run):
#             run.is_response_approved_yet = True
#         else:
#             run.current_response_to_user = None

@predictor
def say_goodbye(conversation: Conversation) -> str:
    """Generate a friendly farewell for this conversation."""

class EndConversationAction(InternalAction):
    def __init__(self):
        super().__init__(
            name="End conversation",
            function="Ends the conversation and stops listening to the user",
            when_to_run="When the users says goodbye or quit. DO NOT QUIT THE CONVERSATION UNLESS THEY ASK YOU TO QUIT.",
            how_to_run="Simply choose to run this action",
            notes="This action will prevent the app from listening to this conversation further"
        )
    
    def act(self, arg: str, run: Run):
        text = say_goodbye(conversation=run.conversation)
        ssml = text_to_ssml(text=text)
        
        run.suggested_responses.append(ChatResponse(text=text, ssml=ssml, external_action=ExternalAction.end_conversation))

@predictor
def select_action(run: Run, actions: list[InternalAction]) -> ActionSelection:
    """You are a friendly voice chatbot. Select an internal action to think or act toward responding to the user. Consider what you have already thought about (your internal thoughts). Do not select the action you just performed. Let's think step by step."""

actions: list[InternalAction] = [
    EndConversationAction(),
    # QueryWolframAlpha()
    SearchGoogleAction(),
    ThinkAction(),
    # ApproveResponseAction(),
    SuggestResponseAction(),
]

@predictor
def choose_response(conversation: Conversation, suggested_responses: list[ChatResponse]) -> ChatResponse:
    """Chooses the most appropriate response of a list of suggested responses in a conversation"""

def chat_response(conversation: Conversation) -> ChatResponse:
    run = Run(conversation=conversation, internal_thoughts=[], internal_action_history=[], suggested_responses=[])
    
    run.internal_thoughts.append(f"Today (and the time) is {datetime.now()}")
    
    iterations_max = 8
    
    last_action = ""
    
    for iteration in range(iterations_max):
        iteration += 1
        
        actions_permit = [action for action in actions if action.name != last_action]
        
        action_selection = select_action(run=run, actions=actions_permit) # type: ActionSelection
        action = next(action for action in actions if action.name == action_selection.action_name)
        print(f"Received action {action_selection.action_name} with {action_selection.arg}")
        run.internal_action_history.append(action_selection)
        
        last_action = action.name
        
        if action is not None:
            action.act(action_selection.arg, run)
        else:
            run.internal_thoughts.append(f"<<The action {action_selection.action_name} does not exist>>")
        
    response = choose_response(conversation=conversation, suggested_responses=run.suggested_responses)

    if response is None:
        text = "<<That was too hard to think>>"
        return ChatResponse(text=text, ssml=text_to_ssml(text=text), external_action=ExternalAction.none)

    return response


