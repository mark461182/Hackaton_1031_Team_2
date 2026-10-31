// 코끼리 목소리: 타입캐스트 TTS 중계. 키는 서버에만 두고 브라우저에는 오디오만 돌려준다
import type { NextRequest } from "next/server";
import { DEFAULT_KID_VOICE_ID } from "@/lib/voice/voices";

const MAX_CHARS = 300; // 공개 주소라 크레딧 낭비 방지
const VOICE_ID = /^tc_[0-9a-f]{24}$/;

export async function POST(req: NextRequest) {
  const key = process.env.TYPECAST_API_KEY;
  if (!key) return Response.json({ error: "TYPECAST_API_KEY가 설정되지 않았어요" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  // 화면이 목소리를 안 넘기면 환경변수 → 팀 기본 목소리(하율) 순서
  const voiceId = VOICE_ID.test(body.voiceId ?? "") ? body.voiceId : process.env.TYPECAST_VOICE_ID || DEFAULT_KID_VOICE_ID;
  if (!text) return Response.json({ error: "text가 비었어요" }, { status: 400 });
  if (text.length > MAX_CHARS) return Response.json({ error: `${MAX_CHARS}자까지만 읽어요` }, { status: 413 });

  const res = await fetch("https://api.typecast.ai/v1/text-to-speech", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({
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
    }),
  });
  if (!res.ok || !res.body) {
    return Response.json({ error: `타입캐스트 오류 ${res.status}` }, { status: 502 });
  }
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
