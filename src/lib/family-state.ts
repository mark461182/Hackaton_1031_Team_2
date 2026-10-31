// 부모·아이 링크로 이어진 한 가족의 저장 상태. 서버와 두 기기가 같은 모양을 쓴다 (store.ts의 저장 모양과 같다)
import type { Alert, Entry, Family, Id, Message, Question, Reply, Share } from "./types";

export type FamilyState = {
  version: 1;
  familyIdByVisitor: Record<string, Id>;
  families: Family[];
  messages: Message[];
  questions: Question[];
  replies: Reply[];
  alerts: Alert[];
  shares: Share[];
  entries: Entry[];
  coinAwardDays: Record<Id, string[]>;
};

export type FamilyPatch = Partial<Omit<FamilyState, "version" | "familyIdByVisitor">>;

const COLLECTIONS = ["messages", "questions", "replies", "alerts", "shares", "entries"] as const;
type AnyRecord = { id: Id; familyId?: Id };

/** 링크로 이어진 기기들이 같이 쓰는 방문자 이름 (기기마다 다른 방문자 ID 대신) */
export const linkVisitorId = (familyId: Id) => `link:${familyId}`;

export function emptyFamilyState(family: Family): FamilyState {
  return {
    version: 1,
    familyIdByVisitor: { [linkVisitorId(family.id)]: family.id },
    families: [family],
    messages: [],
    questions: [],
    replies: [],
    alerts: [],
    shares: [],
    entries: [],
    coinAwardDays: {},
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const listOf = (value: unknown): AnyRecord[] =>
  Array.isArray(value) ? value.filter((item): item is AnyRecord => isRecord(item) && typeof item.id === "string") : [];

/** 이 가족 기록만 남기고 방문자 연결을 고정한다 (다른 가족이나 엉뚱한 연결이 섞이지 않게) */
export function sanitizeFamilyState(raw: unknown, familyId: Id): FamilyState | null {
  if (!isRecord(raw)) return null;
  const families = listOf(raw.families).filter((family) => family.id === familyId) as Family[];
  if (families.length !== 1) return null;
  const state = emptyFamilyState(families[0]);
  for (const name of COLLECTIONS) {
    (state[name] as AnyRecord[]) = listOf(raw[name]).filter((item) => item.familyId === familyId);
  }
  const days = isRecord(raw.coinAwardDays) ? raw.coinAwardDays[familyId] : undefined;
  if (Array.isArray(days)) state.coinAwardDays[familyId] = days.filter((day): day is string => typeof day === "string");
  return state;
}

const byId = <T extends AnyRecord>(items: T[]) => new Map(items.map((item) => [item.id, item]));

/** 마지막으로 서버에서 받은 상태와 비교해 새로 생기거나 바뀐 기록만 뽑는다 (오래된 기록으로 남의 변경을 덮지 않게) */
export function diffFamilyState(base: FamilyState, next: FamilyState): FamilyPatch {
  const patch: FamilyPatch = {};
  const changed = <T extends AnyRecord>(before: T[], after: T[]) => {
    const old = byId(before);
    return after.filter((item) => JSON.stringify(old.get(item.id)) !== JSON.stringify(item));
  };
  const families = changed(base.families, next.families);
  if (families.length) patch.families = families;
  for (const name of COLLECTIONS) {
    const items = changed(base[name] as AnyRecord[], next[name] as AnyRecord[]);
    if (items.length) (patch[name] as AnyRecord[]) = items;
  }
  const days = Object.entries(next.coinAwardDays).filter(
    ([id, list]) => JSON.stringify(base.coinAwardDays[id] ?? []) !== JSON.stringify(list),
  );
  if (days.length) patch.coinAwardDays = Object.fromEntries(days);
  return patch;
}

export const isEmptyPatch = (patch: FamilyPatch) => Object.keys(patch).length === 0;

/** 서버에서 합치기: 기록 id마다 들어온 필드로 덮는다. 새 기록은 더하고, 지우지는 않는다 */
export function mergeFamilyState(stored: FamilyState, patch: FamilyPatch, familyId: Id): FamilyState {
  const merge = <T extends AnyRecord>(current: T[], incoming: T[] | undefined): T[] => {
    if (!incoming?.length) return current;
    const map = byId(current);
    for (const item of incoming) {
      if (item.familyId !== undefined && item.familyId !== familyId) continue;
      map.set(item.id, { ...(map.get(item.id) ?? {}), ...item } as T);
    }
    return [...map.values()];
  };
  const next: FamilyState = { ...stored, families: merge(stored.families, patch.families?.filter((family) => family.id === familyId)) };
  for (const name of COLLECTIONS) {
    (next[name] as AnyRecord[]) = merge(stored[name] as AnyRecord[], patch[name] as AnyRecord[] | undefined);
  }
  const days = patch.coinAwardDays?.[familyId];
  if (days) next.coinAwardDays = { ...stored.coinAwardDays, [familyId]: [...new Set([...(stored.coinAwardDays[familyId] ?? []), ...days])] };
  return next;
}

