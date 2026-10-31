// 링크로 이어진 가족 저장 (서버에서만). Supabase 설정이 있으면 Supabase, 없으면 서버 메모리(로컬 개발용, 재시작하면 사라짐)
// Supabase는 표를 잠가 두고(RLS) 열쇠가 맞는 가족만 돌려주는 함수(elly_family_*)로만 읽고 쓴다 → docs/11_가족_링크.md의 SQL
import { randomBytes, randomUUID } from "node:crypto";

import { emptyFamilyState, mergeFamilyState, sanitizeFamilyState, type FamilyPatch, type FamilyState } from "./family-state";
import type { Family } from "./types";

export type FamilyRole = "parent" | "kid";
type FamilyRow = { id: string; parentKey: string; kidKey: string; state: FamilyState; version: number };

/** 128비트 무작위 열쇠 (링크에 들어가는 비밀 값) */
const newKey = () => randomBytes(16).toString("base64url");

const supabaseUrl = () => (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const supabaseKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** Vercel에서 Supabase 설정이 없으면 쓰지 않는다 (서버 메모리는 요청마다 다른 서버라 기록이 사라진다) */
export const familyStorage = (): "supabase" | "memory" | "unavailable" =>
  supabaseUrl() && supabaseKey() ? "supabase" : process.env.VERCEL ? "unavailable" : "memory";

/** 실제로 쓸 수 있는지: Supabase면 함수가 만들어져 있는지 확인한다 (SQL을 아직 안 돌렸으면 링크 기능을 끈다). 1분 동안 기억 */
let readyCache: { at: number; value: "supabase" | "memory" | "unavailable" } | undefined;
export async function familyStorageReady(): Promise<"supabase" | "memory" | "unavailable"> {
  const storage = familyStorage();
  if (storage !== "supabase") return storage;
  if (readyCache && Date.now() - readyCache.at < 60_000) return readyCache.value;
  let value: "supabase" | "unavailable" = "unavailable";
  try {
    await rpc("elly_family_by_key", { p_key: "probe-probe-probe-probe" });
    value = "supabase";
  } catch {
    value = "unavailable";
  }
  readyCache = { at: Date.now(), value };
  return value;
}

// ───── 서버 메모리 (설정이 없을 때, 로컬 개발용) ─────
const memory: Map<string, FamilyRow> =
  ((globalThis as Record<string, unknown>).__ellyFamilies as Map<string, FamilyRow>) ?? new Map();
(globalThis as Record<string, unknown>).__ellyFamilies = memory;

// ───── Supabase 함수 호출 ─────
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: supabaseKey(), "Content-Type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`supabase ${name} ${res.status}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

type FoundFamily = { row: FamilyRow; role: FamilyRole };

async function findByKey(key: string): Promise<FoundFamily | null> {
  const storage = familyStorage();
  if (!key || key.length < 16 || storage === "unavailable") return null;
  if (storage === "memory") {
    for (const row of memory.values()) {
      if (row.parentKey === key) return { row, role: "parent" };
      if (row.kidKey === key) return { row, role: "kid" };
    }
    return null;
  }
  const rows = await rpc<{ id: string; role: FamilyRole; kid_key: string | null; state: FamilyState; version: number }[]>(
    "elly_family_by_key",
    { p_key: key },
  );
  const found = rows?.[0];
  if (!found) return null;
  return {
    role: found.role,
    row: {
      id: found.id,
      parentKey: found.role === "parent" ? key : "",
      kidKey: found.kid_key ?? (found.role === "kid" ? key : ""),
      state: found.state,
      version: found.version,
    },
  };
}

export async function createFamily(kidName: string) {
  const storage = familyStorage();
  if (storage === "unavailable") throw new Error("가족 링크 저장소가 없어요");
  const id = randomUUID();
  const name = kidName.trim().slice(0, 12) || "우리 아이";
  const family: Family = { id, name: `${name}네`, kidName: name, coins: 0, chargedWon: 0 };
  const row: FamilyRow = { id, parentKey: newKey(), kidKey: newKey(), state: emptyFamilyState(family), version: 1 };
  if (storage === "memory") memory.set(id, row);
  else await rpc("elly_family_insert", { p_id: id, p_parent_key: row.parentKey, p_kid_key: row.kidKey, p_state: row.state });
  return row;
}

export async function readFamily(key: string) {
  return findByKey(key);
}

/** 바뀐 기록을 합쳐 저장한다. 다른 기기가 먼저 저장했으면(버전이 달라졌으면) 새 상태에 다시 합친다 */
export async function writeFamily(key: string, patch: FamilyPatch) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const found = await findByKey(key);
    if (!found) return null;
    const { row, role } = found;
    const state = sanitizeFamilyState(mergeFamilyState(row.state, patch, row.id), row.id) ?? row.state;
    if (familyStorage() === "memory") {
      const next = { ...row, state, version: row.version + 1 };
      memory.set(row.id, next);
      return { row: next, role };
    }
    const version = await rpc<number | null>("elly_family_update", { p_key: key, p_state: state, p_expected: row.version });
    if (typeof version === "number") return { row: { ...row, state, version }, role };
  }
  throw new Error("저장이 겹쳐서 실패했어요");
}

/** 아이 링크 바꾸기 (부모 열쇠로만). 예전 아이 링크는 바로 막힌다 */
export async function rotateKidKey(parentKey: string) {
  const found = await findByKey(parentKey);
  if (!found || found.role !== "parent") return null;
  const kidKey = newKey();
  if (familyStorage() === "memory") {
    const next = { ...found.row, kidKey, version: found.row.version + 1 };
    memory.set(next.id, next);
    return next;
  }
  const version = await rpc<number | null>("elly_family_rotate", { p_parent_key: parentKey, p_new_kid_key: kidKey });
  return typeof version === "number" ? { ...found.row, kidKey, version } : null;
}
