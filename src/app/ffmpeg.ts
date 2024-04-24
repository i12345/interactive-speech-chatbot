"use client"

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import mime from 'mime-types'

interface FFMpegProps {
    onLoaded?: () => void
}

export class FFMpegManager {
    private onLoaded?: () => void
    private loaded = false
    private ffmpeg = new FFmpeg()

    get isLoaded() {
        return this.loaded
    }

    constructor({ onLoaded }: FFMpegProps) {
        this.onLoaded = onLoaded

        void this.load()
    }

    private async load() {
        // https://ffmpegwasm.netlify.app/docs/getting-started/usage
        // https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/apps/nextjs-app/app/Home.tsx
  
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
        
        this.ffmpeg.on('log', ({ message }) => {
            console.log(message);
        });
        // toBlobURL is used to bypass CORS issue, urls with the same
        // domain can be used directly.
        await this.ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        this.loaded = true
        this.onLoaded?.()
    }

    async concatAudio(audio: Blob[]) {
        const files = audio.map<[filename: string, Blob]>((blob, i) => [`${i}.${mime.extension(blob.type)}`, blob])
        
        // https://trac.ffmpeg.org/wiki/Concatenate#samecodec

        let filesList = files.map(([filename]) => `file '${filename}'`).join('\n')
        if (!await this.ffmpeg.writeFile("filesList.txt", await fetchFile(new Blob([filesList], { type: "text/plain" }))))
            throw new Error("Could not write instructions")

        for (const [filename, audio] of files)
            if (!await this.ffmpeg.writeFile(filename, await fetchFile(audio)))
                throw new Error(`Could not write audio file ${filename}`)
        
        const outputFile = `output.${mime.extension(audio[0].type)}`

        await this.ffmpeg.exec([
            '-f',
            'concat',
            '-safe',
            '0',
            '-i',
            'filesList.txt',
            '-c',
            'copy',
            outputFile
        ])

        const result = <any>await this.ffmpeg.readFile(outputFile)
        return new Blob([result.buffer], { type: audio[0].type })
    }
}