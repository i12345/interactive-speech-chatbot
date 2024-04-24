"use client"

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import SilenceAwareRecorder from './recorder';
import { FFMpegManager } from './ffmpeg';

enum State {
  Loading = "Loading",
  Listening = "Listening",
  ProcessingAudioOnBrowser = "Preparing data for server",
  Thinking = "Thinking",
  Responding = "Responding",
  Quit = "Quit",
}

export function ChatApp() {
    const ffmpeg = useRef<FFMpegManager>()
    const [state, setState] = useState(State.Loading)
    const [error, setError] = useState<string>()

    const [log, setLog] = useState<string[]>([])
    const [volume, setVolume] = useState<number>()

    const recorder = useRef<SilenceAwareRecorder>()
    const currentAudio = useRef<Blob[]>([])
    
    const sendChat = useCallback(async () => {
        const audioChunks = currentAudio.current!.splice(0, currentAudio.current!.length)

        const currentAudioLengthTime = audioChunks.reduce((totalLength, blob) => totalLength + blob.size, 0) / (recorder.current!.bitRate / 8)
        const min_record_length = 1

        const newLog = [...log, `${currentAudioLengthTime.toFixed(1)}s`]
        setLog(newLog)
        log.splice(0, log.length, ...newLog)
      
        if (currentAudioLengthTime < min_record_length)
            return
        
        try {
            setState(State.ProcessingAudioOnBrowser)
            const recording = await ffmpeg.current!.concatAudio(audioChunks)

            setState(State.Thinking)
  
            // https://developer.mozilla.org/en-US/docs/Learn/Forms/Sending_forms_through_JavaScript
            const formData = new FormData()
            formData.append("recording", recording)
            const response = await fetch("http://localhost:3001/chat/", {
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
    if (ffmpeg.current == null) {
        ffmpeg.current = new FFMpegManager({
            async onLoaded() {
                console.log("ffmpeg loaded")

                recorder.current = new SilenceAwareRecorder({
                    onDataAvailable: recording => {
                        currentAudio.current!.push(recording)
                    },
                    onVolumeChange: volume => setVolume(volume),
                    onSilenceChanged: isSilentNow => {
                        if (isSilentNow) {
                            void sendChat()
                        }
                        else {
                            setState(State.Listening)
                        }
                    },
                    silenceDuration: 2500,
                    silentThreshold: -25,
                    minDecibels: -100,
                    timeSlice: 1000,
                    stopRecorderOnSilence: true,
                })

                await recorder.current!.startRecording()
                setState(State.Listening)
            }
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