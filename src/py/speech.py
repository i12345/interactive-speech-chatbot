# based from https://cloud.google.com/speech-to-text/v2/docs/transcribe-client-libraries

from google.cloud.speech_v2 import SpeechClient
from google.cloud.speech_v2.types import cloud_speech

project_id = "hw10-420720"

client_sst = SpeechClient()

"""Synthesizes speech from the input string of text or ssml.
Make sure to be working in a virtual environment.

Note: ssml must be well-formed according to:
    https://www.w3.org/TR/speech-synthesis/
"""
from google.cloud import texttospeech

# Instantiates a client
client_tts = texttospeech.TextToSpeechClient()


config_sst = cloud_speech.RecognitionConfig(
        auto_decoding_config=cloud_speech.AutoDetectDecodingConfig(),
        language_codes=["en-US"],
        model="long",
    )

def speech_to_text(speech: bytes) -> str:
    request = cloud_speech.RecognizeRequest(
        recognizer=f"projects/{project_id}/locations/global/recognizers/_",
        config=config_sst,
        content=speech,
    )

    # Transcribes the audio into text
    response = client_sst.recognize(request=request)
    
    return response.results[0].alternatives[0].transcript

def text_to_speech(text: str) -> bytes:
    # https://cloud.google.com/text-to-speech/docs/create-audio-text-client-libraries#client-libraries-install-python
    
    # Set the text input to be synthesized
    synthesis_input = texttospeech.SynthesisInput(text=text)

    voice = texttospeech.VoiceSelectionParams(
        language_code="en-US", ssml_gender=texttospeech.SsmlVoiceGender.MALE
    )

    # Select the type of audio file you want returned
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.OGG_OPUS
    )

    # Perform the text-to-speech request on the text input with the selected
    # voice parameters and audio file type
    response = client_tts.synthesize_speech(
        input=synthesis_input, voice=voice, audio_config=audio_config
    )

    return response.audio_content