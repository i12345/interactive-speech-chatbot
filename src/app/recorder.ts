"use client"

// adapted from SilenceAwareRecorder.ts
// MIT License, by tenlau (Dmitriy O.)
// https://github.com/teunlao/silence-aware-recorder/blob/main/packages/recorder/src/lib/SilenceAwareRecorder.ts

export type OnVolumeChange = (volume: number) => void;
export type OnDataAvailable = (data: Blob) => void | undefined;

// added
export type OnSilenceChanged = (isSilentNow: boolean) => void | undefined;

export interface SilenceAwareRecorderOptions {
  deviceId?: string;
  minDecibels?: number;
  onDataAvailable?: OnDataAvailable;
  onVolumeChange?: OnVolumeChange;
  onSilenceChanged?: OnSilenceChanged;
  onConcatDataAvailable?: OnDataAvailable;

  setDeviceId?: (deviceId: string) => void;
  silenceDetectionEnabled?: boolean;

  silenceDuration?: number;

  silentThreshold?: number;
  stopRecorderOnSilence?: boolean;
  timeSlice?: number;
}

class SilenceAwareRecorder {
  private readonly silenceDetectionEnabled: boolean;

  private readonly timeSlice: number;

  private audioContext: AudioContext | null;

  private mediaStreamSource: MediaStreamAudioSourceNode | null;

  private analyser: AnalyserNode | null;

  private mediaRecorder: MediaRecorder | null;

  private silenceTimeout: ReturnType<typeof setTimeout> | null;

  private readonly silenceThreshold: number;

  private readonly silenceDuration: number;

  private readonly minDecibels: number;

  private readonly onVolumeChange?: OnVolumeChange;

  private readonly onDataAvailable?: OnDataAvailable;

  private readonly onSilenceChanged?: OnSilenceChanged;

  private readonly onConcatDataAvailable?: OnDataAvailable;

  private readonly concatData: Blob[] = [];

  private _concatAudio = true;

  private isSilence: boolean;

  private hasSoundStarted: boolean;

  public deviceId: string | null;

  public isRecording: boolean;

  private readonly stopRecorderOnSilence: boolean;

  private animationFrameId: number | null;

  // added
  get bitRate() {
    return this.mediaRecorder!.audioBitsPerSecond
  }

  get concatAudio() {
    return this._concatAudio
  }

  set concatAudio(concatAudio) {
    if (this._concatAudio && !concatAudio)
      this.concatData.splice(0, this.concatData.length)
    
    this._concatAudio = concatAudio
  }

  constructor({
    onVolumeChange,
    onDataAvailable,
    onSilenceChanged,
    onConcatDataAvailable,
    silenceDuration = 2500,
    silentThreshold = -50,
    minDecibels = -100,
    deviceId = 'default',
    timeSlice = 250,
    silenceDetectionEnabled = true,
    stopRecorderOnSilence = false,
  }: SilenceAwareRecorderOptions) {
    this.silenceDetectionEnabled = silenceDetectionEnabled;
    this.stopRecorderOnSilence = stopRecorderOnSilence;
    this.timeSlice = timeSlice;
    this.audioContext = null;
    this.mediaStreamSource = null;
    this.analyser = null;
    this.mediaRecorder = null;
    this.silenceTimeout = null;
    this.silenceThreshold = silentThreshold;
    this.silenceDuration = silenceDuration;
    this.minDecibels = minDecibels;
    this.onVolumeChange = onVolumeChange;
    this.onDataAvailable = onDataAvailable;
    this.onSilenceChanged = onSilenceChanged;
    this.onConcatDataAvailable = onConcatDataAvailable;
    this.isSilence = false;
    this.hasSoundStarted = false;
    this.deviceId = deviceId;
    this.isRecording = false;
    this.animationFrameId = null;
  }

  resumeConcat(timePrev = 0) {
    if (!this.concatAudio) {
      const dataKeep = Math.ceil(timePrev / this.timeSlice)
      this.concatData.splice(0, Math.min(this.concatData.length, this.concatData.length - dataKeep))
      this.concatAudio = true
    }
  }

  stopConcat() {
    this.concatAudio = false
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) {
      return;
    }

    try {
      const stream = await this.getAudioStream();
      this.setupAudioContext(stream);
      this.setupMediaRecorder(stream);
      this.isRecording = true;
      this.checkForSilence();
    } catch (err) {
      console.error('Error getting audio stream:', err);
    }
  }

  private async getAudioStream(): Promise<MediaStream> {
    // eslint-disable-next-line no-undef
    const constraints: MediaStreamConstraints = {
      // This is diff from original code
      audio: true,
      // audio: this.deviceId ? { deviceId: { exact: this.deviceId } } : true,
      video: false,
    };

    return navigator.mediaDevices.getUserMedia(constraints);
  }

  private setupAudioContext(stream: MediaStream): void {
    this.audioContext = new AudioContext();
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.minDecibels = this.minDecibels;
    this.mediaStreamSource.connect(this.analyser);
  }

  private setupMediaRecorder(stream: MediaStream): void {
    this.mediaRecorder = new MediaRecorder(stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && !this.isSilence) {
        if (this.concatAudio)
          this.concatData.push(event.data);
        this.onDataAvailable?.(event.data);
      }
    };

    this.mediaRecorder.start(this.timeSlice);
  }

  async getAvailableDevices(): Promise<MediaDeviceInfo[]> {
    return navigator.mediaDevices.enumerateDevices();
  }

  setDevice(deviceId: string): void {
    if (this.deviceId !== deviceId) {
      this.deviceId = deviceId;
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        // If the recording is running, stop it before switching devices
        this.stopRecording();
      }
    }
  }

  stopRecording(): void {
    if (!this.isRecording) {
      return;
    }

    if (this.mediaRecorder && this.hasSoundStarted && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.requestData();
      setTimeout(() => {
        this.cleanUp();
      }, 100); // adjust this delay as necessary
    } else {
      this.cleanUp();
    }

    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  private cleanUp(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder?.stop();
      cancelAnimationFrame(this.animationFrameId!);
    }
    this.mediaRecorder?.stream?.getTracks().forEach((track) => track.stop());
    this.audioContext?.close();
    this.hasSoundStarted = false;
    this.isRecording = false;
  }

  private checkForSilence(): void {
    if (!this.mediaRecorder) {
      throw new Error('MediaRecorder is not available');
    }

    if (!this.analyser) {
      throw new Error('Analyser is not available');
    }

    const bufferLength = this.analyser.fftSize;
    const amplitudeArray = new Float32Array(bufferLength || 0);
    this.analyser.getFloatTimeDomainData(amplitudeArray);

    const volume = this.computeVolume(amplitudeArray);

    this.onVolumeChange?.(volume);

    if (this.silenceDetectionEnabled) {
      const isSilentNow = (volume < this.silenceThreshold)
      
      if (isSilentNow) {
        if (!this.silenceTimeout) {
          this.silenceTimeout = setTimeout(() => {
            if (this.stopRecorderOnSilence) {
              this.mediaRecorder?.stop();
            }
            this.isSilence = true;
            this.silenceTimeout = null;
            this.onSilenceChanged?.(isSilentNow);
            
            // https://mitya.uk/articles/concatenating-audio-pure-javascript
            const concatAudio = new Blob(this.concatData.splice(0, this.concatData.length));
            this.onConcatDataAvailable?.(concatAudio);
          }, this.silenceDuration);
        }
      } else {
        if (this.silenceTimeout) {
          clearTimeout(this.silenceTimeout);
          this.silenceTimeout = null;
        }
        if (this.isSilence) {
          if (this.stopRecorderOnSilence) {
            this.mediaRecorder.start(this.timeSlice);
            this.onSilenceChanged?.(isSilentNow);
          }
          this.isSilence = false;
        }
        if (!this.hasSoundStarted) {
          this.hasSoundStarted = true;
        }
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this.checkForSilence());
  }

  private computeVolume(amplitudeArray: Float32Array): number {
    const values = amplitudeArray.reduce((sum, value) => sum + value * value, 0);
    const average = Math.sqrt(values / amplitudeArray.length); // calculate rms
    const volume = 20 * Math.log10(average); // convert to dB
    return volume;
  }
}

export default SilenceAwareRecorder;