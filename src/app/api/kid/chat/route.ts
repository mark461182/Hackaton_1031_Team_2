// 아이 메시지 → 코끼리 답·분류·부모에게 갈 것 (docs/03 API). 저장하지 않는다: 화면이 응답을 store.ts로 저장
// LLM(래블업) 설정이 있으면 진짜, 없거나 실패하면 가짜 응답(mock: true). 응답 모양은 같다
import type { NextRequest } from "next/server";
import { kidChat } from "@/lib/llm/kokkiri";
import type { KidChatRequest } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Partial<KidChatRequest> | null;
  if (!body || typeof body.kidText !== "string" || !body.kidText.trim()) {
    return Response.json({ error: "kidText가 필요해요" }, { status: 400 });
  }
  if (body.kidText.length > 1000) return Response.json({ error: "kidText가 너무 길어요" }, { status: 413 });
  const request: KidChatRequest = {
    familyId: typeof body.familyId === "string" ? body.familyId : "",
    kidName: typeof body.kidName === "string" ? body.kidName : undefined,
    kidText: body.kidText,
    history: Array.isArray(body.history) ? body.history.slice(-20) : [],
    pendingQuestion: body.pendingQuestion ?? null,
  };
  return Response.json(await kidChat(request));
}
