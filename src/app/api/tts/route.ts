// 코끼리 목소리: 타입캐스트 TTS 중계. 키는 서버에만 두고 브라우저에는 오디오만 돌려준다
import type { NextRequest } from "next/server";
import { DEFAULT_KID_VOICE_ID, TTS_MAX_CHARS as MAX_CHARS } from "@/lib/voice/voices";

const VOICE_ID = /^tc_[0-9a-f]{24}$/;

// 팀원 계정 키 여러 개를 돌려 쓴다: TYPECAST_API_KEYS=키1,키2,... (없으면 TYPECAST_API_KEY 하나)
function apiKeys(): string[] {
  const many = (process.env.TYPECAST_API_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  return many.length ? many : [process.env.TYPECAST_API_KEY ?? ""].filter(Boolean);
}
let nextKey = 0; // 요청마다 시작 키를 바꿔 크레딧·동시 요청 한도를 나눠 쓴다

// 크레딧 부족(402)·동시 요청 초과(429)·키 오류(401/403)면 다음 키로
const TRY_NEXT = new Set([401, 402, 403, 429]);

export async function POST(req: NextRequest) {
  // 개발 중 크레딧 아끼기: TTS_CLOUD=off 면 바로 거절 → 화면은 브라우저 목소리로 대체
  if (process.env.TTS_CLOUD === "off") return Response.json({ error: "TTS_CLOUD=off" }, { status: 503 });
  const keys = apiKeys();
  if (!keys.length) return Response.json({ error: "TYPECAST_API_KEY(S)가 설정되지 않았어요" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  // 화면이 목소리를 안 넘기면 환경변수 → 팀 기본 목소리(하율) 순서
  const voiceId = VOICE_ID.test(body.voiceId ?? "") ? body.voiceId : process.env.TYPECAST_VOICE_ID || DEFAULT_KID_VOICE_ID;
  if (!text) return Response.json({ error: "text가 비었어요" }, { status: 400 });
  if (text.length > MAX_CHARS) return Response.json({ error: `${MAX_CHARS}자까지만 읽어요` }, { status: 413 });

  const payload = JSON.stringify({
    voice_id: voiceId,
    text,
    model: "ssfm-v31",
    language: "kor",
    // 문맥으로 감정을 고르게: 직전 문장(아이 말 등)을 같이 넘기면 더 자연스럽다
    prompt: {
      emotion_type: "smart",
      ...(typeof body.previousText === "string" && body.previousText ? { previous_text: body.previousText.slice(0, MAX_CHARS) } : {}),
    },
    output: { audio_format: "mp3", target_lufs: -16 },
  });

  const start = nextKey++ % keys.length;
  let lastStatus = 0;
  for (let i = 0; i < keys.length; i++) {
    const res = await fetch("https://api.typecast.ai/v1/text-to-speech", {
      method: "POST",
      headers: { "X-API-KEY": keys[(start + i) % keys.length], "Content-Type": "application/json" },
      body: payload,
    });
    if (res.ok && res.body) {
      return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
    }
    lastStatus = res.status;
    if (!TRY_NEXT.has(res.status)) break;
  }
  return Response.json({ error: `타입캐스트 오류 ${lastStatus}` }, { status: 502 });
}
