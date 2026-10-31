// Hands the browser a short-lived ElevenLabs signed URL. The API key stays on the server.
import { timingSafeEqual } from "node:crypto";

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
};

const sameCode = (given, expected) => {
  const a = Buffer.from(String(given || "")), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

export default async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  const code = process.env.PLAY_CODE;
  if (code && !sameCode(req.headers["x-play-code"], code)) return send(res, 401, { error: "Wrong play code." });
  if (url.searchParams.get("check")) return send(res, 200, { ok: true });

  const lang = url.searchParams.get("lang") === "ru" ? "RU" : "EN";
  const agent = process.env[`ELEVENLABS_AGENT_${lang}`];
  const key = process.env.ELEVENLABS_API_KEY;
  if (!agent || !key) return send(res, 500, { error: "Voice is not configured on the server." });

  const r = await fetch(`https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${agent}`, {
    headers: { "xi-api-key": key },
  });
  if (!r.ok) {
    console.error("ElevenLabs refused a signed URL:", r.status);
    return send(res, 502, { error: "Could not reach ElevenLabs." });
  }
  const { signed_url } = await r.json();
  return send(res, 200, { signedUrl: signed_url });
}
