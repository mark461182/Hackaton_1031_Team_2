// 부모가 아이 링크를 만든다: 새 가족 + 부모 열쇠 + 아이 열쇠 (docs/11_가족_링크.md)
import type { NextRequest } from "next/server";
import { createFamily, familyStorage, familyStorageReady } from "@/lib/family-server";

/** 가족 링크를 쓸 수 있는지 (Supabase 키가 없는 배포에서는 unavailable → 화면이 예전처럼 한 기기 안에서 돈다) */
export async function GET() {
  return Response.json({ storage: await familyStorageReady() });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { kidName?: unknown } | null;
  const kidName = typeof body?.kidName === "string" ? body.kidName : "";
  try {
    const row = await createFamily(kidName);
    return Response.json({
      familyId: row.id,
      parentKey: row.parentKey,
      kidKey: row.kidKey,
      state: row.state,
      version: row.version,
      storage: familyStorage(),
    });
  } catch {
    return Response.json({ error: "가족을 만들지 못했어요" }, { status: 502 });
  }
}
