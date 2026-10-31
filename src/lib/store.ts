import type {
  Alert,
  Entry,
  Family,
  Id,
  IsoTime,
  Message,
  Question,
  Reply,
  Share,
} from "./types";
import { toLocalIsoDate } from "./date.ts";

export type ParentFeedItem =
  | { kind: "reply"; createdAt: IsoTime; data: Reply }
  | { kind: "alert"; createdAt: IsoTime; data: Alert }
  | { kind: "share"; createdAt: IsoTime; data: Share };

export type KidTurnCommit = {
  kidMessage: Message;
  kokkiriMessage: Message;
  askedQuestionId?: Id;
  answeredQuestionId?: Id;
  changedAt: IsoTime;
  reply?: Reply;
  alert?: Alert;
  share?: Share;
};

export type FinishConversationResult = {
  status: "awarded" | "too_short" | "already_awarded";
  coins: number;
  awardedCoins: number;
};

export type EllyStore = {
  getOrCreateDemoFamily(visitorId: string): Promise<Family>;
  resetDemoFamily(visitorId: string): Promise<Family>;
  saveMessage(message: Message): Promise<void>;
  getMessages(familyId: Id): Promise<Message[]>;
  saveQuestion(question: Question): Promise<void>;
  getQuestions(familyId: Id): Promise<Question[]>;
  getPendingQuestion(familyId: Id): Promise<Question | undefined>;
  markQuestionAsked(familyId: Id, questionId: Id, askedAt: IsoTime): Promise<void>;
  markQuestionAnswered(familyId: Id, questionId: Id, answeredAt: IsoTime): Promise<void>;
  saveReply(reply: Reply): Promise<void>;
  saveAlert(alert: Alert): Promise<void>;
  saveShare(share: Share): Promise<void>;
  setShareStatus(familyId: Id, shareId: Id, status: Share["status"]): Promise<void>;
  commitKidTurn(turn: KidTurnCommit): Promise<void>;
  resolveShare(familyId: Id, shareId: Id, status: "accepted" | "declined"): Promise<void>;
  finishConversation(familyId: Id, finishedAt: IsoTime): Promise<FinishConversationResult>;
  saveEntry(entry: Entry): Promise<void>;
  getEntries(familyId: Id): Promise<Entry[]>;
  getParentFeed(familyId: Id): Promise<ParentFeedItem[]>;
  subscribe(listener: () => void): () => void;
};

type MemoryState = {
  familyIdByVisitor: Map<string, Id>;
  families: Map<Id, Family>;
  messages: Map<Id, Message>;
  questions: Map<Id, Question>;
  replies: Map<Id, Reply>;
  alerts: Map<Id, Alert>;
  shares: Map<Id, Share>;
  entries: Map<Id, Entry>;
  coinAwardDays: Map<Id, Set<string>>;
};

type PersistedState = {
  version: 1;
  familyIdByVisitor: Record<string, Id>;
  families: Family[];
  messages: Message[];
  questions: Question[];
  replies: Reply[];
  alerts: Alert[];
  shares: Share[];
  entries?: Entry[];
  coinAwardDays?: Record<Id, string[]>;
};

type MemoryStoreOptions = {
  initialState?: PersistedState;
  onChange?: (state: PersistedState) => void;
  timezoneOffsetMinutes?: number;
};

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type StoreSync = {
  publish(raw: string): void;
  subscribe(listener: (raw: string) => void): () => void;
};

const STORE_STORAGE_KEY = "elly:store:v1";
const VISITOR_STORAGE_KEY = "elly:visitor:v1";

const createId = (): Id => globalThis.crypto.randomUUID();
const recordKey = (familyId: Id, id: Id) => JSON.stringify([familyId, id]);

const sortOldestFirst = <T extends { createdAt: IsoTime }>(items: T[]): T[] =>
  items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

const createState = (persisted?: PersistedState): MemoryState => ({
  familyIdByVisitor: new Map(Object.entries(persisted?.familyIdByVisitor ?? {})),
  families: new Map((persisted?.families ?? []).map((item) => [item.id, item])),
  messages: new Map((persisted?.messages ?? []).map((item) => [recordKey(item.familyId, item.id), item])),
  questions: new Map((persisted?.questions ?? []).map((item) => [recordKey(item.familyId, item.id), item])),
  replies: new Map((persisted?.replies ?? []).map((item) => [recordKey(item.familyId, item.id), item])),
  alerts: new Map((persisted?.alerts ?? []).map((item) => [recordKey(item.familyId, item.id), item])),
  shares: new Map((persisted?.shares ?? []).map((item) => [recordKey(item.familyId, item.id), item])),
  entries: new Map((persisted?.entries ?? []).map((item) => [recordKey(item.familyId, item.id), item])),
  coinAwardDays: new Map(
    Object.entries(persisted?.coinAwardDays ?? {}).map(([familyId, days]) => [familyId, new Set(days)]),
  ),
});

const toPersistedState = (state: MemoryState): PersistedState => ({
  version: 1,
  familyIdByVisitor: Object.fromEntries(state.familyIdByVisitor),
  families: [...state.families.values()],
  messages: [...state.messages.values()],
  questions: [...state.questions.values()],
  replies: [...state.replies.values()],
  alerts: [...state.alerts.values()],
  shares: [...state.shares.values()],
  entries: [...state.entries.values()],
  coinAwardDays: Object.fromEntries(
    [...state.coinAwardDays.entries()].map(([familyId, days]) => [familyId, [...days]]),
  ),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFamily = (value: unknown): value is Family =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.name === "string" &&
  typeof value.kidName === "string" &&
  typeof value.coins === "number" &&
  typeof value.chargedWon === "number";

const isFamilyRecord = (value: unknown): value is { id: Id; familyId: Id; createdAt: IsoTime } =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.familyId === "string" &&
  typeof value.createdAt === "string";

const isEntry = (value: unknown): value is Entry =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.familyId === "string" &&
  typeof value.date === "string" &&
  (value.type === "chat" || value.type === "photo") &&
  typeof value.ref === "string" &&
  (value.diary === undefined ||
    (Array.isArray(value.diary) && value.diary.every((line) => typeof line === "string")));

const parsePersistedState = (raw: string | null): PersistedState | undefined => {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (
      parsed.version !== 1 ||
      typeof parsed.familyIdByVisitor !== "object" ||
      parsed.familyIdByVisitor === null ||
      !Array.isArray(parsed.families) ||
      !parsed.families.every(isFamily) ||
      !Array.isArray(parsed.messages) ||
      !parsed.messages.every(isFamilyRecord) ||
      !Array.isArray(parsed.questions) ||
      !parsed.questions.every(isFamilyRecord) ||
      !Array.isArray(parsed.replies) ||
      !parsed.replies.every(isFamilyRecord) ||
      !Array.isArray(parsed.alerts) ||
      !parsed.alerts.every(isFamilyRecord) ||
      !Array.isArray(parsed.shares)
      || !parsed.shares.every(isFamilyRecord) ||
      (parsed.entries !== undefined &&
        (!Array.isArray(parsed.entries) || !parsed.entries.every(isEntry))) ||
      (parsed.coinAwardDays !== undefined &&
        (!isRecord(parsed.coinAwardDays) ||
          !Object.values(parsed.coinAwardDays).every(
            (days) => Array.isArray(days) && days.every((day) => typeof day === "string"),
          )))
    ) {
      return undefined;
    }
    if (!Object.values(parsed.familyIdByVisitor).every((familyId) => typeof familyId === "string")) {
      return undefined;
    }
    return parsed as PersistedState;
  } catch {
    return undefined;
  }
};

export function createMemoryStore(options: MemoryStoreOptions = {}): EllyStore {
  const state = createState(options.initialState);
  const listeners = new Set<() => void>();

  const emit = () => {
    options.onChange?.(toPersistedState(state));
    listeners.forEach((listener) => listener());
  };

  const createFamily = (visitorId: string): Family => {
    const family: Family = {
      id: createId(),
      name: "준우네",
      kidName: "준우",
      coins: 0,
      chargedWon: 0,
    };
    state.familyIdByVisitor.set(visitorId, family.id);
    state.families.set(family.id, family);
    return family;
  };

  const removeFamilyData = (familyId: Id) => {
    state.families.delete(familyId);
    state.coinAwardDays.delete(familyId);
    for (const collection of [
      state.messages,
      state.questions,
      state.replies,
      state.alerts,
      state.shares,
      state.entries,
    ]) {
      for (const [id, item] of collection) {
        if (item.familyId === familyId) collection.delete(id);
      }
    }
  };

  return {
    async getOrCreateDemoFamily(visitorId) {
      const familyId = state.familyIdByVisitor.get(visitorId);
      const family = familyId ? state.families.get(familyId) : undefined;
      if (family) return family;

      const created = createFamily(visitorId);
      emit();
      return created;
    },

    async resetDemoFamily(visitorId) {
      const familyId = state.familyIdByVisitor.get(visitorId);
      if (familyId) removeFamilyData(familyId);
      state.familyIdByVisitor.delete(visitorId);

      const family = createFamily(visitorId);
      emit();
      return family;
    },

    async saveMessage(message) {
      state.messages.set(recordKey(message.familyId, message.id), message);
      emit();
    },

    async getMessages(familyId) {
      return sortOldestFirst([...state.messages.values()].filter((message) => message.familyId === familyId));
    },

    async saveQuestion(question) {
      state.questions.set(recordKey(question.familyId, question.id), question);
      emit();
    },

    async getQuestions(familyId) {
      return sortOldestFirst([...state.questions.values()].filter((question) => question.familyId === familyId));
    },

    async getPendingQuestion(familyId) {
      const questions = sortOldestFirst(
        [...state.questions.values()].filter(
          (question) => question.familyId === familyId && question.answeredAt === undefined,
        ),
      );
      return questions[0];
    },

    async markQuestionAsked(familyId, questionId, askedAt) {
      const key = recordKey(familyId, questionId);
      const question = state.questions.get(key);
      if (!question) return;
      state.questions.set(key, { ...question, askedAt });
      emit();
    },

    async markQuestionAnswered(familyId, questionId, answeredAt) {
      const key = recordKey(familyId, questionId);
      const question = state.questions.get(key);
      if (!question) return;
      state.questions.set(key, { ...question, answeredAt });
      emit();
    },

    async saveReply(reply) {
      state.replies.set(recordKey(reply.familyId, reply.id), reply);
      emit();
    },

    async saveAlert(alert) {
      state.alerts.set(recordKey(alert.familyId, alert.id), alert);
      emit();
    },

    async saveShare(share) {
      state.shares.set(recordKey(share.familyId, share.id), share);
      emit();
    },

    async setShareStatus(familyId, shareId, status) {
      const key = recordKey(familyId, shareId);
      const share = state.shares.get(key);
      if (!share) return;
      state.shares.set(key, { ...share, status });
      emit();
    },

    async commitKidTurn(turn) {
      const familyId = turn.kidMessage.familyId;
      const familyRecords = [turn.kokkiriMessage, turn.reply, turn.alert, turn.share].filter(
        (record): record is Message | Reply | Alert | Share => record !== undefined,
      );
      if (familyRecords.some((record) => record.familyId !== familyId)) {
        throw new Error("한 가족의 대화만 함께 저장할 수 있어요");
      }

      const askedKey = turn.askedQuestionId
        ? recordKey(familyId, turn.askedQuestionId)
        : undefined;
      const answeredKey = turn.answeredQuestionId
        ? recordKey(familyId, turn.answeredQuestionId)
        : undefined;
      const askedQuestion = askedKey ? state.questions.get(askedKey) : undefined;
      const answeredQuestion = answeredKey ? state.questions.get(answeredKey) : undefined;
      if ((askedKey && !askedQuestion) || (answeredKey && !answeredQuestion)) {
        throw new Error("부모 질문을 찾을 수 없어요");
      }

      state.messages.set(recordKey(familyId, turn.kidMessage.id), turn.kidMessage);
      state.messages.set(recordKey(familyId, turn.kokkiriMessage.id), turn.kokkiriMessage);
      if (askedKey && askedQuestion) {
        state.questions.set(askedKey, { ...askedQuestion, askedAt: turn.changedAt });
      }
      if (answeredKey && answeredQuestion) {
        state.questions.set(answeredKey, { ...answeredQuestion, answeredAt: turn.changedAt });
      }
      if (turn.reply) state.replies.set(recordKey(familyId, turn.reply.id), turn.reply);
      if (turn.alert) state.alerts.set(recordKey(familyId, turn.alert.id), turn.alert);
      if (turn.share) state.shares.set(recordKey(familyId, turn.share.id), turn.share);
      emit();
    },

    async resolveShare(familyId, shareId, status) {
      const shareKey = recordKey(familyId, shareId);
      const share = state.shares.get(shareKey);
      if (!share) throw new Error("공유 제안을 찾을 수 없어요");

      state.shares.set(shareKey, { ...share, status });
      if (status === "declined") {
        const messageKey = recordKey(familyId, share.messageId);
        const message = state.messages.get(messageKey);
        if (message) {
          state.messages.set(messageKey, { ...message, keepFromParent: "share_declined" });
        }
      }
      emit();
    },

    async finishConversation(familyId, finishedAt) {
      const family = state.families.get(familyId);
      if (!family) throw new Error("가족을 찾을 수 없어요");

      const day = toLocalIsoDate(finishedAt, options.timezoneOffsetMinutes);
      const awardedDays = state.coinAwardDays.get(familyId) ?? new Set<string>();
      if (awardedDays.has(day)) {
        return { status: "already_awarded", coins: family.coins, awardedCoins: 0 };
      }

      const kidTurnCount = [...state.messages.values()].filter(
        (message) =>
          message.familyId === familyId &&
          message.from === "kid" &&
          toLocalIsoDate(message.createdAt, options.timezoneOffsetMinutes) === day &&
          message.createdAt <= finishedAt,
      ).length;
      if (kidTurnCount < 3) {
        return { status: "too_short", coins: family.coins, awardedCoins: 0 };
      }

      const awardedCoins = 10;
      const updatedFamily = { ...family, coins: family.coins + awardedCoins };
      awardedDays.add(day);
      state.coinAwardDays.set(familyId, awardedDays);
      state.families.set(familyId, updatedFamily);
      emit();
      return { status: "awarded", coins: updatedFamily.coins, awardedCoins };
    },

    async saveEntry(entry) {
      for (const [key, saved] of state.entries) {
        if (
          saved.familyId === entry.familyId &&
          saved.date === entry.date &&
          saved.type === entry.type
        ) {
          state.entries.delete(key);
        }
      }
      state.entries.set(recordKey(entry.familyId, entry.id), entry);
      emit();
    },

    async getEntries(familyId) {
      return [...state.entries.values()]
        .filter((entry) => entry.familyId === familyId)
        .sort((a, b) => a.date.localeCompare(b.date));
    },

    async getParentFeed(familyId) {
      const replies: ParentFeedItem[] = [...state.replies.values()]
        .filter((reply) => reply.familyId === familyId)
        .map((data) => ({ kind: "reply", createdAt: data.createdAt, data }));
      const alerts: ParentFeedItem[] = [...state.alerts.values()]
        .filter((alert) => alert.familyId === familyId)
        .map((data) => ({ kind: "alert", createdAt: data.createdAt, data }));
      const shares: ParentFeedItem[] = [...state.shares.values()]
        .filter((share) => share.familyId === familyId && share.status === "accepted")
        .map((data) => ({ kind: "share", createdAt: data.createdAt, data }));

      return [...replies, ...alerts, ...shares].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const getDefaultLocalStorage = (): StorageLike | undefined => {
  if (typeof window === "undefined") {
    throw new Error("기본 elly store는 브라우저에서만 사용할 수 있어요");
  }
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

const getDefaultSessionStorage = (): StorageLike | undefined => {
  if (typeof window === "undefined") {
    throw new Error("elly 방문자 ID는 브라우저에서만 만들 수 있어요");
  }
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
};

const createDefaultStoreSync = (): StoreSync | undefined => {
  if (typeof window === "undefined") return undefined;

  if (typeof window.BroadcastChannel === "function") {
    const channel = new window.BroadcastChannel("elly:store-sync:v1");
    return {
      publish(raw) {
        channel.postMessage(raw);
      },
      subscribe(listener) {
        const receive = (event: MessageEvent<unknown>) => {
          if (typeof event.data === "string") listener(event.data);
        };
        channel.addEventListener("message", receive);
        return () => channel.removeEventListener("message", receive);
      },
    };
  }

  return {
    publish() {
      // localStorage 변경 이벤트가 다른 탭에 상태를 전달한다.
    },
    subscribe(listener) {
      const receive = (event: StorageEvent) => {
        if (event.key === STORE_STORAGE_KEY && event.newValue) listener(event.newValue);
      };
      window.addEventListener("storage", receive);
      return () => window.removeEventListener("storage", receive);
    },
  };
};

export function createBrowserStore(storage?: StorageLike, sync?: StoreSync): EllyStore {
  let memoryStore: EllyStore | undefined;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());

  const getMemoryStore = () => {
    if (memoryStore) return memoryStore;

    const target = storage ?? getDefaultLocalStorage();
    const activeSync = sync ?? createDefaultStoreSync();
    let initialState: PersistedState | undefined;
    try {
      initialState = parsePersistedState(target?.getItem(STORE_STORAGE_KEY) ?? null);
    } catch {
      initialState = undefined;
    }

    const createActiveStore = (state?: PersistedState) =>
      createMemoryStore({
        initialState: state,
        onChange(changedState) {
          const raw = JSON.stringify(changedState);
          try {
            target?.setItem(STORE_STORAGE_KEY, raw);
          } catch {
            // 브라우저 저장이 막혀도 현재 탭의 메모리 저장은 계속 사용한다.
          }
          activeSync?.publish(raw);
          notify();
        },
      });

    memoryStore = createActiveStore(initialState);
    activeSync?.subscribe((raw) => {
      const syncedState = parsePersistedState(raw);
      if (!syncedState) return;
      memoryStore = createActiveStore(syncedState);
      try {
        target?.setItem(STORE_STORAGE_KEY, raw);
      } catch {
        // 동기화된 상태는 현재 탭의 메모리에서 계속 사용한다.
      }
      notify();
    });
    return memoryStore;
  };

  return new Proxy({} as EllyStore, {
    get(_target, property: keyof EllyStore) {
      if (property === "subscribe") {
        getMemoryStore();
        return (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        };
      }
      const activeStore = getMemoryStore();
      const value = activeStore[property];
      return typeof value === "function" ? value.bind(activeStore) : value;
    },
  });
}

let memoryVisitorId: string | undefined;

export function getVisitorId(storage?: StorageLike, legacyStorage?: StorageLike): string {
  const target = storage ?? getDefaultLocalStorage();
  try {
    const saved = target?.getItem(VISITOR_STORAGE_KEY);
    if (saved) return saved;
  } catch {
    // 아래 메모리 ID를 사용한다.
  }

  const legacyTarget = legacyStorage ?? (storage ? undefined : getDefaultSessionStorage());
  try {
    const legacyVisitorId = legacyTarget?.getItem(VISITOR_STORAGE_KEY);
    if (legacyVisitorId) {
      try {
        target?.setItem(VISITOR_STORAGE_KEY, legacyVisitorId);
      } catch {
        // 영구 저장이 막히면 현재 세션의 기존 ID를 계속 사용한다.
      }
      memoryVisitorId = legacyVisitorId;
      return legacyVisitorId;
    }
  } catch {
    // 기존 세션 저장소를 읽지 못하면 새 ID를 만든다.
  }

  memoryVisitorId ??= createId();
  try {
    target?.setItem(VISITOR_STORAGE_KEY, memoryVisitorId);
  } catch {
    // 영구 저장이 막혀도 현재 탭에서는 같은 ID를 유지한다.
  }
  return memoryVisitorId;
}

export function getStoreMode(): "memory" {
  return "memory";
}

export const store = createBrowserStore();
