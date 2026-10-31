// 고정 대사 mp3 만들기: node scripts/gen-fixed-voice.mjs
// src/lib/voice/fixed.ts 목록 중 public/voice/에 아직 없는 문장만 만든다 (그 문장 글자 수만큼 크레딧 사용)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const env = Object.fromEntries(
  (existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const key = (env.TYPECAST_API_KEYS || env.TYPECAST_API_KEY || "").split(",")[0].trim();
if (!key) throw new Error(".env.local에 TYPECAST_API_KEY(S)가 없어요");

const src = readFileSync("src/lib/voice/fixed.ts", "utf8");
const lines = [...src.matchAll(/\{ file: "([a-z0-9-]+)", text: "([^"]+)" \}/g)].map((m) => ({ file: m[1], text: m[2] }));
const voiceId =
  env.TYPECAST_VOICE_ID || readFileSync("src/lib/voice/voices.ts", "utf8").match(/DEFAULT_KID_VOICE_ID = "(tc_[0-9a-f]+)"/)[1];

mkdirSync("public/voice", { recursive: true });
let used = 0;
for (const { file, text } of lines) {
  const out = `public/voice/${file}.mp3`;
  if (existsSync(out)) continue;
  const res = await fetch("https://api.typecast.ai/v1/text-to-speech", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      voice_id: voiceId,
      text,
      model: "ssfm-v31",
      language: "kor",
      prompt: { emotion_type: "smart" },
      output: { audio_format: "mp3", target_lufs: -16 },
    }),
  });
  if (!res.ok) throw new Error(`${file}: ${res.status} ${await res.text()}`);
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  used += text.length;
  console.log("생성", out, text);
}
console.log(`완료 · 이번에 쓴 크레딧 약 ${used}`);
