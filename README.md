# Last Ride 3AM

West Texas, August 1973. One night shift, three strangers in the back seat, and only your voice, the mirror and the radio. Passengers are spoken live through ElevenLabs conversational agents.

## Run locally

Create `.env` containing `ELEVENLABS_API_KEY=...`, then:

```bash
npm run dev
```

Open http://localhost:4173 in Chrome or Safari and allow the microphone.

## Deploy on Vercel

Set these environment variables:

- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_EN` and `ELEVENLABS_AGENT_RU` (`node server.mjs --print-agents` prints them)
- `PLAY_CODE`: the code players must enter, which protects your voice credits

Never commit `.env`.
