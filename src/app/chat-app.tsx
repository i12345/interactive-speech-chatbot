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

export function ChatApp() {
    const [state, setState] = useState(State.Loading)
    const [error, setError] = useState<string>()

    const [log, setLog] = useState<string[]>([])
    const [volume, setVolume] = useState<number>()

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
            setState(State.Thinking)

            // https://developer.mozilla.org/en-US/docs/Learn/Forms/Sending_forms_through_JavaScript
            const formData = new FormData()
            formData.append("audio", audio)
            const response = await fetch("https://localhost:3001/chat/", {
                method: "POST",
                // Set the FormData instance as the request body
                body: formData,
            })
            response.json()
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
                    {log.map((entry, i) => <div key={i}>{entry}</div>)}
                </div>
            </div>
        </main>
    )
}