"use client"

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import SilenceAwareRecorder from './recorder';

enum State {
  Loading = "Loading",
  Waiting = "Waiting",
  Listening = "Listening",
  ProcessingAudioOnBrowser = "Preparing data for server",
  Thinking = "Thinking",
  Responding = "Responding",
  Quit = "Quit",
}

export default function Home() {
  const [state, setState] = useState(State.Loading)
  const [error, setError] = useState<string>()

  const [log, setLog] = useState<string[]>([])
  const [volume, setVolume] = useState<number>()

  const recorder = useRef<SilenceAwareRecorder>()
  const currentAudio = useRef<Blob[]>([])

  const sendChat = useCallback(async () => {
    const currentAudioLengthTime = currentAudio.current!.reduce((totalLength, blob) => totalLength + blob.size, 0) / recorder.current!.bitRate
    const min_record_length = 1

    if (currentAudioLengthTime < min_record_length)
      return

    setState(State.ProcessingAudioOnBrowser)

    throw new Error()

    setState(State.Thinking)
    
    try {
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
  if (recorder.current == null) {
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
      silentThreshold: -10,
      minDecibels: -100,
      timeSlice: 1000,
      stopRecorderOnSilence: true,
    })
  }

  const startRecord = useCallback(async () => {
      await recorder.current!.startRecording()
      setState(State.Listening)
  }, [recorder, setState])

  useLayoutEffect(() => {
    void startRecord()
  }, [startRecord])

  return (
    <main className="flex flex-col items-center">
      <div className='self-center'>
        <div className="">{error}</div>
        {volume ? (
          <>
            <div>Volume: {volume.toFixed(1)} dB</div>
          </> 
        ) : <></>}
        <button onClick={startRecord} disabled={state !== State.Waiting}>{state === State.Waiting ? "Record" : state}</button>
        <div className='flex flex-col-reverse'>
          {log.map((entry, i) => <div key={i}>{entry}</div>)}
        </div>
      </div>
    </main>
  );
}
