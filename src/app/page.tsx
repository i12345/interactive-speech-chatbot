"use client"

// based from https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/apps/nextjs-app/app/page.tsx

import NoSSRWrapper from "./NoSSRWrapper"
import { ChatApp } from "./chat-app"

export default function Home() {
  return <NoSSRWrapper><ChatApp /></NoSSRWrapper>
}
