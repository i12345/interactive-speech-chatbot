# Readme

[Demo and code explained](https://www.youtube.com/watch?v=PXres3W9wGM)

This is an interactive speech chatbot made with [dspy](https://github.com/stanfordnlp/dspy) and [Google cloud speech](https://cloud.google.com/speech-to-text/) [libraries](https://cloud.google.com/text-to-speech) in a [fastapi](https://fastapi.tiangolo.com/) backend server with a [Next.js/React](https://nextjs.org/) frontend made using a modified version of [SilenceAwareRecorder](https://github.com/teunlao/silence-aware-recorder).

To run, after configuring a `.env` file and authorizing gcloud, run `npm run start:app` then `npm run start:api`. Connect to frontend at `https://localhost:3000/` and chat with speech!
