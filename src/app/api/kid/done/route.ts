// 오늘 대화 → 3줄 일기 ("말하지 마"·[싫어] 제외, docs/03 API). 저장하지 않는다. 코인은 store.ts가 준다
// LLM(래블업) 설정이 있으면 진짜, 없거나 실패하면 가짜 응답(mock: true)
import type { NextRequest } from "next/server";
import { kidDone } from "@/lib/llm/kokkiri";
import type { KidDoneRequest } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Partial<KidDoneRequest> | null;
  if (!body || !Array.isArray(body.messages)) {
    return Response.json({ error: "messages 배열이 필요해요" }, { status: 400 });
  }
  return Response.json(
    await kidDone({
      familyId: typeof body.familyId === "string" ? body.familyId : "",
      kidName: typeof body.kidName === "string" ? body.kidName : undefined,
      messages: body.messages.slice(-100),
    }),
  );
}
