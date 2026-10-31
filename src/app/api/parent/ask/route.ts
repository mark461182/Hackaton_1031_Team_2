// 부모 걱정·질문 → 아이가 답하기 쉬운 질문으로 다듬기 (docs/03 API). 저장하지 않는다
// 지금은 가짜 응답(mock: true). Bedrock이 붙으면 이 자리에서 LLM을 부른다
import type { NextRequest } from "next/server";
import { mockParentAsk } from "@/lib/llm/mock";
import type { ParentAskRequest } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Partial<ParentAskRequest> | null;
  if (!body || typeof body.text !== "string" || !body.text.trim()) {
    return Response.json({ error: "text가 필요해요" }, { status: 400 });
  }
  if (body.text.length > 1000) return Response.json({ error: "text가 너무 길어요" }, { status: 413 });
  return Response.json(
    mockParentAsk({
      familyId: typeof body.familyId === "string" ? body.familyId : "",
      kidName: typeof body.kidName === "string" ? body.kidName : undefined,
      text: body.text,
    }),
  );
}
