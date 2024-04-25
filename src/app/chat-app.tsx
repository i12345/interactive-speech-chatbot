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

interface Message {
    role: 'user' | 'assistant'
    content: string
}

interface Conversation {
    messages: Message[]
}

interface ChatResponse {
    ssml: string
    text: string
}

export function ChatApp() {
    const [state, setState] = useState(State.Loading)
    const [error, setError] = useState<string>()

    const [log, setLog] = useState<string[]>([])
    const [volume, setVolume] = useState<number>()
    const [messages, setMessages] = useState<Message[]>([])

    const recorder = useRef<SilenceAwareRecorder>()
    
    const sendChat = useCallback(async (audio: Blob) => {
        const currentAudioLengthTime = audio.size / (recorder.current!.bitRate / 8)
        const min_record_length = 1.75

        if (currentAudioLengthTime < min_record_length)
            return

        const newLog = [...log, `${currentAudioLengthTime.toFixed(1)}s`]
        setLog(newLog)
        log.splice(0, log.length, ...newLog)

        async function sst() {
            // https://developer.mozilla.org/en-US/docs/Learn/Forms/Sending_forms_through_JavaScript
            const formData = new FormData()
            formData.append("audio", audio)
            const api_response = await fetch("https://localhost:3001/sst/", {
                method: "POST",
                // Set the FormData instance as the request body
                body: formData,
            })
            return await api_response.text()
        }

        function addMessage(msg: Message) {
            messages.push(msg)
            setMessages([...messages])
        }
        
        setError(undefined)
        try {
            setState(State.Thinking)

            addMessage({
                role: "user",
                content: await sst()
            })

            const conversation: Conversation = {
                messages,
            }

            // https://developer.mozilla.org/en-US/docs/Learn/Forms/Sending_forms_through_JavaScript
            const formData = new FormData()
            formData.append("conversation", JSON.stringify(conversation))
            const api_response = await fetch("https://localhost:3001/chat/", {
                method: "POST",
                // Set the FormData instance as the request body
                body: formData,
            })
            const response = await api_response.json() as ChatResponse

            addMessage({
                content: response.text,
                role: "assistant"
            })

            // const audioResponse = new Audio(`https://localhost:3001/tts?ssml=${response.ssml}`)
            // audioResponse.addEventListener('ended', () => {
            //     setState(State.Listening)
            // })
            // setState(State.Responding)
            // await audioResponse.play()
        }
        catch (x) {
            setError(String(x))
        }

        recorder.current!.startRecording()
        setState(State.Listening)
    }, [setState, recorder, setLog, log])

    // https://react.dev/reference/react/useRef#avoiding-recreating-the-ref-contents
    if (recorder.current == null) {
        recorder.current = new SilenceAwareRecorder({
            onVolumeChange: volume => setVolume(volume),
            onSilenceChanged: isSilentNow => {
                if (isSilentNow) {
                    setState(State.Listening)
                }
                else {
                    setState(State.Listening)
                }
            },
            onConcatDataAvailable: audio => void sendChat(audio),
            silenceDuration: 2500,
            silentThreshold: -25,
            minDecibels: -100,
            timeSlice: 1000,
            stopRecorderOnSilence: true,
        })

        recorder.current!.startRecording().then(() => {
            setState(State.Listening)
        })
    }

    return (
        <main className="flex flex-col items-center">
            <div className='self-center'>
                <div className="">{error}</div>
                {volume ? (
                    <>
                        <div>Volume: {volume.toFixed(0)} dB</div>
                    </>
                ) : <></>}
                <div>{state}</div>
                <div className='flex flex-col-reverse'>
                    {messages.map(msg => (
                        <div className={"rounded-md m-2 p-2 " + (msg.role === 'user' ? 'bg-gray-300 align-left' : 'bg-blue-800 align-right')}>
                            {msg.content}
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