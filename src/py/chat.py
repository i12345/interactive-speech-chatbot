from abc import ABC, abstractmethod
from enum import Enum
from typing import Literal, Optional
from pydantic import BaseModel
from dspy.functional import cot, predictor
import dspy

dspy.configure(lm=dspy.OpenAI())

class Message(BaseModel):
    role: str
    content: str

class Conversation(BaseModel):
    messages: list[Message]
    
class ExternalAction(BaseModel):
    name: str

class ChatResponse(BaseModel):
    ssml: str
    text: str

class AgentRun(BaseModel):
    conversation: Conversation
    internal_thoughts: list[str] = []
    response_to_user: Optional[ChatResponse]

class InternalAction(BaseModel, ABC):
    """An action that you can do"""
    name: str
    function: str
    when_to_run: str
    how_to_run: str
    notes: str
    
    @abstractmethod
    def act(self, arg: str, agent_run: AgentRun):
        pass

class ActionSelection(BaseModel):
    action_name: str
    arg: Optional[str]

@predictor
def text_to_ssml(text: str) -> str:
    """Convert the text to SSML for speech synthesis (with emotion where appropriate)"""

class RespondAction(InternalAction):
    def __init__(self):
        super().__init__(
            name="Respond",
            function="Respond to user",
            when_to_run="When you think you have enough information or want to respond.",
            how_to_run="Put your response in the action arg",
            notes="This action will send your response to the user"
        )
        
    def act(self, arg: str, agent_run: AgentRun):
        text = arg
        ssml = text_to_ssml(text=text)
        
        agent_run.response_to_user = ChatResponse(text=text, ssml=ssml)

class ThinkAction(InternalAction):
    def __init__(self):
        super().__init__(
            name="Think",
            function="Think internal thought",
            when_to_run="When you have a question or thought you want to record.",
            how_to_run="Put your thought in the action arg",
            notes="This will save the thought to short-term memory; it will only persist in current exchange"
        )
        
    def act(self, arg: str, agent_run: AgentRun):
        thought = arg
        agent_run.internal_thoughts.append(thought)
        
# class SearchAction(InternalAction):
#     def __init__(self):
#         super().__init__(
#             name="Search",
#             function="Search the internal for a query",
#             when_to_run="When you have a question about current events or technical info you want to look up.",
#             notes="This will search Google"
#         )
        
#     def act(self, arg: str, agent_run: AgentRun):
#         query = arg
#         results = ""
#         agent_run.internal_thoughts.append(f"Search for {query}\n\n{results}")

@predictor
def select_action(run: AgentRun, actions: list[InternalAction]) -> ActionSelection:
    """Select an internal action to respond to the user's last chat"""

actions: list[InternalAction] = [
    RespondAction(),
    ThinkAction(),
]

def chat_response(conversation: Conversation) -> ChatResponse:
    run = AgentRun(conversation=conversation, internal_thoughts=[], response_to_user=None)
    
    while run.response_to_user is None:
        action_selection = select_action(run=run, actions=actions) # type: ActionSelection
        action = next(action for action in actions if action.name == action_selection.action_name)
        if action is not None:
            action.act(action_selection.arg, run)
        else:
            run.internal_thoughts.append(f"<<The action {action_selection.action_name} does not exist>>")

    return run.response_to_user


