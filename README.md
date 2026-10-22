# ElevenLabs Narrator

A local text-to-speech studio for turning pasted text into downloadable audio with ElevenLabs.

## Requirements

- Node.js 20.6 or newer
- An ElevenLabs API key with access to voices and text-to-speech

## Run locally

1. In the project folder, run `npx -y @elevenlabs/cli@latest onboard init` and follow the browser sign-in prompts. The CLI saves your API key in `.env.local`.
2. Run `npm start`.
3. Open <http://127.0.0.1:3000>.

Alternatively, put `ELEVENLABS_API_KEY=your_elevenlabs_api_key` in `.env`; the app also loads that file.

The app loads voices from your ElevenLabs account. Paste up to 10,000 characters, choose a voice and narration model, and click **Create narration**. The generated audio appears in the player and can be downloaded as an MP3.

The API key is read by the local Node.js server and is never sent to the browser. Keep `.env` and `.env.local` private; both are gitignored. This starter app binds to localhost and is intended for local use; add authentication and deployment-specific protections before exposing it to other users.

## Available models

- Eleven v3 — expressive narration
- Multilingual v2 — multilingual speech
- Flash v2.5 — fast generation
- Turbo v2.5 — low-latency generation
