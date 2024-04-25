"use client"

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import SilenceAwareRecorder from './recorder';

enum State {
    Loading = "Loading",
    Listening = "Listening",
    ListeningPassive = `${State.Listening}Passive`,
    ListeningActive = `${State.Listening}Active`,
    Thinking = "Thinking",
    Responding = "Responding",
    Quit = "Quit",
}

const stateClasses: Record<State, string> = {
    [State.Loading]: "transparent",
    [State.ListeningPassive]: "bg-gray-400",
    [State.ListeningActive]: "bg-gray-600",
    [State.Listening]: "bg-gray-400",
    [State.Thinking]: "bg-blue-500",
    [State.Responding]: "bg-blue-600",
    [State.Quit]: "transparent",
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
    const [hearsSpeech, setHearsSpeech] = useState(false)
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
            return await api_response.json() as string
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

            const audioResponse = new Audio(`https://localhost:3001/tts?ssml=${response.ssml}`)
            audioResponse.addEventListener('ended', () => {
                setHearsSpeech(true)
                recorder.current!.resumeConcat(0.5)
                setState(State.Listening)
            })
            audioResponse.addEventListener('error', () => {
                setHearsSpeech(true)
                recorder.current!.resumeConcat()
                setState(State.Listening)
            })

            setState(State.Responding)
            recorder.current!.stopConcat()
            await audioResponse.play()
        }
        catch (x) {
            recorder.current!.resumeConcat()
            setError(String(x))
            console.error(x)
            setHearsSpeech(false)
            setState(State.Listening)
        }
    }, [setState, recorder, setLog, log, setMessages, messages, setHearsSpeech])

    // https://react.dev/reference/react/useRef#avoiding-recreating-the-ref-contents
    if (recorder.current == null) {
        recorder.current = new SilenceAwareRecorder({
            onVolumeChange: volume => setVolume(volume),
            onSilenceChanged: isSilentNow => {
                setHearsSpeech(!isSilentNow)

                // if (!isSilentNow)
                //     recorder.current!.resumeConcat(0.5)
            },
            onConcatDataAvailable: audio => void sendChat(audio),
            silenceDuration: 2500,
            silentThreshold: -28,
            minDecibels: -100,
            timeSlice: 200,
            stopRecorderOnSilence: true,
            // stopRecorderOnSilence: false,
        })

        recorder.current!.startRecording().then(() => {
            setState(State.Listening)
            setHearsSpeech(true)
        })
    }

    return (
        <main className="flex flex-col items-center">
            <div className='self-center'>
                <p className={`m-2 px-3 py-2 rounded-md ${stateClasses[state == State.Listening ? hearsSpeech ? State.ListeningActive : State.ListeningPassive : state]}`}>{state}</p>
                <div className='flex flex-col max-w-screen-sm'>
                    {[...messages].reverse().map((msg, i) => (
                        <div key={messages.length - i} className={"rounded-md m-2 px-3 py-2 " + (msg.role === 'user' ? `bg-gray-300 text-slate-900 text-slate align-left` : `bg-blue-800 text-slate-100 align-right`)}>
                            {msg.content}
                        </div>
                    ))}
                </div>
            </div>
        </main>
    )
}