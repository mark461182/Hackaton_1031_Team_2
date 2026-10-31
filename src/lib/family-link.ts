// 부모·아이 링크 (브라우저 쪽). 부모가 만든 아이 링크(/kid?k=열쇠)로 들어온 기기만 그 가족 기록을 같이 쓴다
// 데모(/demo와 그 안의 화면)는 링크 없이 이 기기 안에서만 돈다
import {
  diffFamilyState,
  isEmptyPatch,
  sanitizeFamilyState,
  type FamilyState,
} from "./family-state.ts";
import type { Id } from "./types";

export type FamilyLink = { role: "parent" | "kid"; key: string; familyId: Id; kidKey?: string };
export type FamilyStateResponse = { role: "parent" | "kid"; familyId: Id; state: FamilyState; version: number; kidKey?: string };

const LINK_STORAGE_KEY = "elly:link:v1";
export const LINK_STORE_STORAGE_KEY = "elly:store:link:v1";
const POLL_MS = 2500;

export function parseFamilyLink(raw: string | null): FamilyLink | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<FamilyLink>;
    if ((value.role !== "parent" && value.role !== "kid") || typeof value.key !== "string" || typeof value.familyId !== "string") {
      return null;
    }
    return { role: value.role, key: value.key, familyId: value.familyId, kidKey: typeof value.kidKey === "string" ? value.kidKey : undefined };
  } catch {
    return null;
  }
}

const safeStorage = (): Storage | undefined => {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

/** /demo 페이지이거나 다른 화면 안에 들어 있으면(데모의 두 폰) 데모 */
export function isDemoContext(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.location.pathname.startsWith("/demo") || window.self !== window.top;
  } catch {
    return true; // 다른 출처 안에 들어 있으면 top을 못 읽는다
  }
}

export function readFamilyLink(): FamilyLink | null {
  return parseFamilyLink(safeStorage()?.getItem(LINK_STORAGE_KEY) ?? null);
}

/** 지금 화면이 쓸 링크. 데모에서는 쓰지 않는다 */
export function activeFamilyLink(): FamilyLink | null {
  return isDemoContext() ? null : readFamilyLink();
}

/** 링크를 저장하고 서버 기록을 미리 넣어 둔다 (첫 화면이 빈 가족을 새로 만들지 않게). 저장한 뒤 새로고침한다 */
export function saveFamilyLink(link: FamilyLink, state: FamilyState) {
  const storage = safeStorage();
  storage?.setItem(LINK_STORAGE_KEY, JSON.stringify(link));
  storage?.setItem(LINK_STORE_STORAGE_KEY, JSON.stringify(state));
}

export function clearFamilyLink() {
  const storage = safeStorage();
  storage?.removeItem(LINK_STORAGE_KEY);
  storage?.removeItem(LINK_STORE_STORAGE_KEY);
}

/** 서버에 가족 링크 저장소가 있는지 */
export async function familyLinkAvailable(): Promise<boolean> {
  try {
    const res = await fetch("/api/family", { cache: "no-store" });
    if (!res.ok) return false;
    const body = (await res.json()) as { storage?: string };
    return body.storage === "supabase" || body.storage === "memory";
  } catch {
    return false;
  }
}

export async function fetchFamilyState(key: string): Promise<FamilyStateResponse | null> {
  const res = await fetch("/api/family/state", { headers: { "x-family-key": key }, cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as FamilyStateResponse;
}

export function kidLinkUrl(origin: string, kidKey: string) {
  return `${origin}/kid?k=${encodeURIComponent(kidKey)}`;
}

export function parentLinkUrl(origin: string, parentKey: string) {
  return `${origin}/parent?p=${encodeURIComponent(parentKey)}`;
}

/**
 * store.ts가 쓰는 동기화: 이 기기에서 바뀐 기록만 서버에 보내고(PUT), 다른 기기의 변경은 2.5초마다 받아 온다(GET)
 * publish/subscribe 모양은 store.ts의 StoreSync와 같다
 */
export function createRemoteStoreSync(link: FamilyLink) {
  const listeners = new Set<(raw: string) => void>();
  let base: FamilyState | null = null;
  let version = 0;
  let pending: FamilyState | null = null;
  let sending = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  const accept = (body: FamilyStateResponse) => {
    const state = sanitizeFamilyState(body.state, link.familyId);
    if (!state) return;
    const changed = body.version !== version;
    base = state;
    version = body.version;
    // 아직 보내지 않은 이 기기의 변경이 있으면 화면 기록을 서버 것으로 바꾸지 않는다 (그 변경이 지워지지 않게). 다음 저장·받기에서 맞춰진다
    if (changed && !pending) listeners.forEach((listener) => listener(JSON.stringify(state)));
  };

  const pull = async () => {
    if (sending || pending) return;
    try {
      const res = await fetch("/api/family/state", { headers: { "x-family-key": link.key }, cache: "no-store" });
      if (res.status === 404) {
        // 부모가 링크를 바꿨거나 가족이 없어졌다 → 이 기기의 연결을 지우고 다시 연다 (아이 화면은 링크 안내가 뜬다)
        clearFamilyLink();
        window.location.reload();
        return;
      }
      if (res.ok) accept((await res.json()) as FamilyStateResponse);
    } catch {
      // 다음에 다시 받는다
    }
  };

  const push = async () => {
    if (sending || !pending) return;
    if (!base) {
      await pull();
      if (!base) return;
    }
    sending = true;
    const next = pending;
    pending = null;
    try {
      const patch = diffFamilyState(base, next);
      if (!isEmptyPatch(patch)) {
        const res = await fetch("/api/family/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "x-family-key": link.key },
          body: JSON.stringify({ patch }),
        });
        if (res.ok) accept((await res.json()) as FamilyStateResponse);
        else pending = pending ?? next; // 다음에 다시 보낸다
      }
    } catch {
      pending = pending ?? next;
    } finally {
      sending = false;
      if (pending) void push();
    }
  };

  return {
    publish(raw: string) {
      const state = sanitizeFamilyState(JSON.parse(raw), link.familyId);
      if (!state) return;
      pending = state;
      void push();
    },
    subscribe(listener: (raw: string) => void) {
      listeners.add(listener);
      if (!timer) {
        void pull();
        timer = setInterval(() => void pull(), POLL_MS);
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size && timer) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
  };
}
