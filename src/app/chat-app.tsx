"use client"

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import SilenceAwareRecorder from './recorder';

enum State {
  Loading = "Loading",
  Waiting = "Waiting for speech",
  Listening = "Listening",
  Thinking = "Thinking",
  Responding = "Responding",
  Quit = "Quit",
}

enum MsgPerson {
    user = "user",
    ai = "ai",
}

interface Msg {
    person: MsgPerson
    content: string
}

interface Conversation {
    messages: Msg[]
}

interface ChatResponse {
    transcribed_message: string
    response_chat: string
    response_chat_ssml: string
}

export function ChatApp() {
    const [state, setState] = useState(State.Loading)
    const [error, setError] = useState<string>()

    const [log, setLog] = useState<string[]>([])
    const [volume, setVolume] = useState<number>()
    const [isSilent, setIsSilent] = useState(false)

    const [messages, setMessages] = useState<Msg[]>([])

    const recorder = useRef<SilenceAwareRecorder>()
    
    const sendChat = useCallback(async (audio: Blob) => {
        const currentAudioLengthTime = audio.size / (recorder.current!.bitRate / 8)
        const min_record_length = 1.75

        if (currentAudioLengthTime < min_record_length)
            return

        const newLog = [...log, `${currentAudioLengthTime.toFixed(1)}s`]
        setLog(newLog)
        log.splice(0, log.length, ...newLog)

        setError(undefined)
        try {
            // recorder.current!.stopRecording()
            // recorder.current!.storeConcatData = false;

            setState(State.Thinking)

            const conversation: Conversation = {
                messages
            }

            // https://developer.mozilla.org/en-US/docs/Learn/Forms/Sending_forms_through_JavaScript
            const formData = new FormData()
            formData.append("audio", audio)
            formData.append("conversation", JSON.stringify(conversation))
            const response = await fetch("https://localhost:3001/chat/", {
                method: "POST",
                // Set the FormData instance as the request body
                body: formData,
            })
            
            const dataResponse: ChatResponse = await response.json()
            console.log("response")
            console.log(dataResponse)

            const newMessages = [...messages,
                { person: MsgPerson.user, content: dataResponse.transcribed_message } as Msg,
                { person: MsgPerson.ai, content: dataResponse.response_chat } as Msg,
            ]
            messages.splice(0, messages.length, ...newMessages)
            setMessages(newMessages)

            setState(State.Listening)
            return

            const audioResponseUrl = `https://localhost:3001/tts?ssml=${dataResponse.response_chat_ssml}`

            const audioResponse = new Audio(audioResponseUrl)
            setState(State.Responding)
            await audioResponse.play()
            audioResponse.addEventListener('ended', async () => {
                // await recorder.current!.startRecording()
                // recorder.current!.storeConcatData = true;
                setState(State.Listening)
            })
        }
        catch (x) {
            setError(String(x))
            // await recorder.current!.startRecording()
            setState(State.Listening)
        }
    }, [setState, recorder, setLog, log])

    // https://react.dev/reference/react/useRef#avoiding-recreating-the-ref-contents
    if (recorder.current == null) {
        recorder.current = new SilenceAwareRecorder({
            onVolumeChange: volume => setVolume(volume),
            onSilenceChanged: isSilentNow => setIsSilent(isSilentNow),
            onConcatDataAvailable: audio => void sendChat(audio),
            silenceDuration: 1000,
            silentThreshold: -30,
            minDecibels: -100,
            timeSlice: 2500,
            // stopRecorderOnSilence: true,
            stopRecorderOnSilence: false,
        })

        recorder.current!.startRecording().then(() => {
            setState(State.Listening)
        })
    }

    return (
        <main className="flex flex-col items-center">
            <div className='self-center'>
                <div className="bg-red">{error}</div>
                {volume ? (
                    <div style={{ background: isSilent ? undefined: 'green' }}>
                        <div>Volume: {volume.toFixed(0)} dB</div>
                    </div>
                ) : <></>}
                <div className='items-center m-1'>{state}</div>

                <div className='flex flex-col-reverse'>
                    {messages.map((msg, i) => (
                        <div key={i} className={`m-2 p-1.5 flex-none w-auto ` + (msg.person === MsgPerson.ai ? 'bg-lime-700 rounded-s-sm rounded-e-xl text-left' : 'bg-gray-800 rounded-e-sm rounded-s-xl text-right')}>
                            <b>{msg.person}</b> {msg.content}
                        </div>
                    ))}
                </div>

                <div className='flex flex-col-reverse'>
                    {log.map((entry, i) => <div key={i}>{entry}</div>)}
                </div>
            </div>
        </main>
    )
}