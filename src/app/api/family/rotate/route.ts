// 아이 링크 바꾸기 (부모 열쇠로만). 예전 아이 링크는 바로 막힌다
import type { NextRequest } from "next/server";
import { rotateKidKey } from "@/lib/family-server";

export async function POST(req: NextRequest) {
  try {
    const row = await rotateKidKey(req.headers.get("x-family-key") ?? "");
    if (!row) return Response.json({ error: "부모 링크가 맞지 않아요" }, { status: 403 });
    return Response.json({ kidKey: row.kidKey });
  } catch {
    return Response.json({ error: "링크를 바꾸지 못했어요" }, { status: 502 });
  }
}
