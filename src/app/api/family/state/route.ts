// 열쇠로 그 가족 기록만 읽고 쓴다. 열쇠는 주소가 아니라 머리글(x-family-key)로 받는다
import type { NextRequest } from "next/server";
import { readFamily, writeFamily } from "@/lib/family-server";
import type { FamilyPatch } from "@/lib/family-state";

const keyOf = (req: NextRequest) => req.headers.get("x-family-key") ?? "";

export async function GET(req: NextRequest) {
  try {
    const found = await readFamily(keyOf(req));
    if (!found) return Response.json({ error: "링크가 맞지 않아요" }, { status: 404 });
    return Response.json({
      role: found.role,
      familyId: found.row.id,
      state: found.row.state,
      version: found.row.version,
      // 부모 열쇠로 열었을 때만 아이 링크를 알려 준다 (다른 폰에서 부모 화면을 열어도 아이 링크를 보이게)
      kidKey: found.role === "parent" ? found.row.kidKey : undefined,
    });
  } catch {
    return Response.json({ error: "기록을 불러오지 못했어요" }, { status: 502 });
  }
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { patch?: FamilyPatch } | null;
  if (!body?.patch || typeof body.patch !== "object") return Response.json({ error: "patch가 필요해요" }, { status: 400 });
  try {
    const saved = await writeFamily(keyOf(req), body.patch);
    if (!saved) return Response.json({ error: "링크가 맞지 않아요" }, { status: 404 });
    return Response.json({ role: saved.role, familyId: saved.row.id, state: saved.row.state, version: saved.row.version });
  } catch {
    return Response.json({ error: "저장하지 못했어요" }, { status: 502 });
  }
}
