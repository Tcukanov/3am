// Last Ride 3AM: local runner. Creates the voice agents if needed, serves the page
// and runs the same /api/session handler that Vercel runs. Reads the key from .env.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4173);
const API = "https://api.elevenlabs.io/v1";
const AGENTS_FILE = join(here, ".agents.json");

const key = readFileSync(join(here, ".env"), "utf8").match(/ELEVENLABS_API_KEY=(\S+)/)?.[1];
if (!key) { console.error("Put ELEVENLABS_API_KEY=... in .env"); process.exit(1); }

async function el(path, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { "xi-api-key": key, "content-type": "application/json", ...init.headers },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${text.slice(0, 600)}`);
  return JSON.parse(text);
}

const STATE_TOOL = {
  type: "client",
  name: "update_state",
  description: "Silently record your hidden state before you speak. Call it once on every turn, before your spoken reply. The driver never hears this.",
  expects_response: false,
  parameters: {
    type: "object",
    required: ["trust", "fear", "irritation", "fatigue", "pose"],
    properties: {
      trust: { type: "number", description: "0-100 trust in the driver" },
      fear: { type: "number", description: "0-100 fear" },
      irritation: { type: "number", description: "0-100 irritation" },
      fatigue: { type: "number", description: "0-100 fatigue" },
      pose: { type: "string", description: "One of: neutral, out_window, watching, lean_forward, hand_on_door, in_bag, head_down, asleep, smile, no_smile" },
      mirror: { type: "string", description: "What the driver could notice in the rear-view mirror, under 10 words. Empty if nothing changed." },
      wants_out: { type: "boolean", description: "True if you have asked to be let out" },
      lie_caught: { type: "boolean", description: "True if you just caught the driver in a lie" },
      decided_not_to_go: { type: "boolean", description: "Danny only: he has accepted being talked out of reporting" },
      gave_name: { type: "boolean", description: "The driver has told you his name" },
      gave_kids: { type: "boolean", description: "The driver has told you about his children" },
      gave_home: { type: "boolean", description: "The driver has told you where he lives" },
    },
  },
};

const LANGS = {
  en: { language: "en", tts: "eleven_flash_v2", voice: "bIHbv24MWmeRgasZH58o" },
  ru: { language: "ru", tts: "eleven_flash_v2_5", voice: "bIHbv24MWmeRgasZH58o" },
};

function agentConfig(lang) {
  const c = LANGS[lang];
  return {
    name: `Last Ride 3AM (${lang})`,
    conversation_config: {
      agent: {
        first_message: "",
        language: c.language,
        prompt: {
          prompt: "You are a passenger in a car at night. Say very little.",
          llm: process.env.AGENT_LLM || "claude-haiku-4-5",
          temperature: 0.8,
          max_tokens: 400,
          tools: [STATE_TOOL],
        },
      },
      tts: {
        model_id: c.tts,
        voice_id: c.voice,
        agent_output_audio_format: "pcm_16000",
        optimize_streaming_latency: 3,
        stability: 0.45,
        similarity_boost: 0.8,
      },
      asr: { quality: "high", provider: "elevenlabs", user_input_audio_format: "pcm_16000" },
      turn: { turn_timeout: 30, silence_end_call_timeout: -1, mode: "turn" },
      conversation: { max_duration_seconds: 1200 },
    },
    platform_settings: {
      overrides: {
        conversation_config_override: {
          agent: { prompt: { prompt: true }, first_message: true, language: true },
          tts: { voice_id: true },
        },
      },
    },
  };
}

let agents = existsSync(AGENTS_FILE) ? JSON.parse(readFileSync(AGENTS_FILE, "utf8")) : {};
async function agentId(lang) {
  if (agents[lang]) return agents[lang];
  const made = await el("/convai/agents/create", { method: "POST", body: JSON.stringify(agentConfig(lang)) });
  agents[lang] = made.agent_id;
  writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2));
  console.log(`Created ${lang} agent ${made.agent_id}`);
  return made.agent_id;
}

process.env.ELEVENLABS_API_KEY = key;
process.env.ELEVENLABS_AGENT_EN = await agentId("en");
process.env.ELEVENLABS_AGENT_RU = await agentId("ru");
if (process.argv.includes("--print-agents")) { console.log(JSON.stringify(agents)); process.exit(0); }
const { default: session } = await import("./api/session.js");

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    return res.end(readFileSync(join(here, "public/index.html")));
  }
  if (/^\/radio\d\.mp3$/.test(url.pathname)) {
    res.writeHead(200, { "content-type": "audio/mpeg" });
    return res.end(readFileSync(join(here, "public", url.pathname)));
  }
  if (url.pathname === "/api/session") return session(req, res);
  res.writeHead(404).end("Not found");
}).listen(PORT, "127.0.0.1", () => console.log(`Last Ride 3AM: http://localhost:${PORT}`));
