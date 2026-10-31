// 새 테스트 패키지 없이 Node 내장 러너로 저장 동작을 검증한다.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type * as StoreModule from "./store";
import type { Alert, Entry, Message, Question, Reply, Share } from "./types";

const require = createRequire(import.meta.url);
const {
  createBrowserStore,
  createMemoryStore,
  getStoreMode,
  getVisitorId,
  store: defaultStore,
} = require("./store.ts") as typeof StoreModule;

const FAMILY_A_VISITOR = "visitor-a";
const FAMILY_B_VISITOR = "visitor-b";

test("같은 방문자는 같은 가족을, 다른 방문자는 다른 가족을 받는다", async () => {
  const store = createMemoryStore();

  const first = await store.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  const again = await store.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  const other = await store.getOrCreateDemoFamily(FAMILY_B_VISITOR);

  assert.deepEqual(again, first);
  assert.notEqual(other.id, first.id);
});

test("아이 메시지를 가족별로 저장하고 변경 구독자에게 알린다", async () => {
  const store = createMemoryStore();
  const family = await store.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  let changeCount = 0;
  const unsubscribe = store.subscribe(() => {
    changeCount += 1;
  });
  const message: Message = {
    id: "message-1",
    familyId: family.id,
    from: "kid",
    text: "오늘 급식에 떡볶이 나왔어",
    createdAt: "2026-11-01T00:00:00.000Z",
    category: "daily",
    confirmed: true,
  };

  await store.saveMessage(message);
  unsubscribe();

  assert.deepEqual(await store.getMessages(family.id), [message]);
  assert.equal(changeCount, 1);
});

test("답하지 않은 가장 오래된 부모 질문 하나만 대기로 돌려준다", async () => {
  const store = createMemoryStore();
  const family = await store.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  const first: Question = {
    id: "question-1",
    familyId: family.id,
    original: "친구와 잘 지내?",
    rewritten: "오늘 친구랑 뭐 하고 놀았어?",
    createdAt: "2026-11-01T00:00:00.000Z",
  };
  const second: Question = {
    id: "question-2",
    familyId: family.id,
    original: "학교는 어때?",
    rewritten: "오늘 학교에서 제일 웃겼던 일은 뭐야?",
    createdAt: "2026-11-01T00:01:00.000Z",
  };

  await store.saveQuestion(first);
  await store.saveQuestion(second);
  assert.equal((await store.getPendingQuestion(family.id))?.id, first.id);

  await store.markQuestionAsked(family.id, first.id, "2026-11-01T00:02:00.000Z");
  assert.equal((await store.getPendingQuestion(family.id))?.id, first.id);

  await store.markQuestionAnswered(family.id, first.id, "2026-11-01T00:03:00.000Z");
  assert.equal((await store.getPendingQuestion(family.id))?.id, second.id);
});

test("부모 피드는 답장·위험·수락한 공유만 최신순으로 돌려준다", async () => {
  const store = createMemoryStore();
  const family = await store.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  const reply: Reply = {
    id: "reply-1",
    familyId: family.id,
    questionId: "question-1",
    answer: "민수랑 축구했어",
    summary: "민수와 축구를 했다고 답했어요",
    note: "축구 이야기를 이어서 물어보세요",
    createdAt: "2026-11-01T00:00:00.000Z",
  };
  const accepted: Share = {
    id: "share-1",
    familyId: family.id,
    messageId: "message-1",
    summary: "친구와 다퉈 속상했다고 말했어요",
    status: "accepted",
    createdAt: "2026-11-01T00:01:00.000Z",
  };
  const declined: Share = {
    id: "share-2",
    familyId: family.id,
    messageId: "message-2",
    summary: "부모에게 보이면 안 되는 공유",
    status: "declined",
    createdAt: "2026-11-01T00:02:00.000Z",
  };
  const alert: Alert = {
    id: "alert-1",
    familyId: family.id,
    quote: "짝꿍이 맨날 때려",
    situation: "친구에게 맞는 일이 있었던 것 같아요",
    guide: "천천히 이야기를 들어 주세요",
    riskType: "violence",
    createdAt: "2026-11-01T00:03:00.000Z",
  };

  await store.saveReply(reply);
  await store.saveShare(accepted);
  await store.saveShare(declined);
  await store.saveAlert(alert);

  assert.deepEqual(
    (await store.getParentFeed(family.id)).map((item) => item.kind),
    ["alert", "share", "reply"],
  );
});

test("공유 상태를 수락으로 바꾸면 부모 피드에 나타난다", async () => {
  const store = createMemoryStore();
  const family = await store.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  const share: Share = {
    id: "share-1",
    familyId: family.id,
    messageId: "message-1",
    summary: "엄마와 같이 말하고 싶은 이야기",
    status: "proposed",
    createdAt: "2026-11-01T00:00:00.000Z",
  };

  await store.saveShare(share);
  assert.deepEqual(await store.getParentFeed(family.id), []);

  await store.setShareStatus(family.id, share.id, "accepted");
  assert.deepEqual(
    (await store.getParentFeed(family.id)).map((item) => item.kind),
    ["share"],
  );
});

test("처음부터 다시는 해당 방문자 데이터만 새 가족으로 초기화한다", async () => {
  const store = createMemoryStore();
  const first = await store.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  const other = await store.getOrCreateDemoFamily(FAMILY_B_VISITOR);
  await store.saveMessage({
    id: "message-1",
    familyId: first.id,
    from: "kid",
    text: "안녕",
    createdAt: "2026-11-01T00:00:00.000Z",
  });

  const reset = await store.resetDemoFamily(FAMILY_A_VISITOR);

  assert.notEqual(reset.id, first.id);
  assert.deepEqual(await store.getMessages(first.id), []);
  assert.deepEqual(await store.getOrCreateDemoFamily(FAMILY_B_VISITOR), other);
});

class FakeStorage implements StoreModule.StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

class FakeSyncHub {
  private listeners = new Set<(raw: string) => void>();

  endpoint(): StoreModule.StoreSync {
    return {
      publish: (raw) => {
        this.listeners.forEach((listener) => listener(raw));
      },
      subscribe: (listener) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
      },
    };
  }
}

test("브라우저 저장소를 다시 열어도 같은 방문자의 가족과 메시지를 복원한다", async () => {
  const storage = new FakeStorage();
  const firstStore = createBrowserStore(storage);
  const family = await firstStore.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  const message: Message = {
    id: "message-1",
    familyId: family.id,
    from: "kid",
    text: "오늘 축구했어",
    createdAt: "2026-11-01T00:00:00.000Z",
  };
  await firstStore.saveMessage(message);

  const reopenedStore = createBrowserStore(storage);

  assert.deepEqual(await reopenedStore.getOrCreateDemoFamily(FAMILY_A_VISITOR), family);
  assert.deepEqual(await reopenedStore.getMessages(family.id), [message]);
});

test("독립 브라우저 store 두 개가 질문과 부모 피드를 즉시 공유한다", async () => {
  const storage = new FakeStorage();
  const hub = new FakeSyncHub();
  const parentStore = createBrowserStore(storage, hub.endpoint());
  const kidStore = createBrowserStore(storage, hub.endpoint());
  parentStore.subscribe(() => undefined);
  kidStore.subscribe(() => undefined);

  const family = await parentStore.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  const kidFamily = await kidStore.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  assert.equal(kidFamily.id, family.id);

  await parentStore.saveQuestion({
    id: "question-synced",
    familyId: family.id,
    original: "오늘 어땠어?",
    rewritten: "오늘 기억에 남는 일은 뭐야?",
    createdAt: "2026-11-01T00:00:00.000Z",
  });
  assert.equal((await kidStore.getPendingQuestion(family.id))?.id, "question-synced");

  await kidStore.saveReply({
    id: "reply-synced",
    familyId: family.id,
    questionId: "question-synced",
    answer: "축구했어",
    summary: "축구 이야기",
    note: "함께 이야기해 보세요",
    createdAt: "2026-11-01T00:01:00.000Z",
  });
  assert.equal((await parentStore.getParentFeed(family.id))[0]?.kind, "reply");
});

test("브라우저 저장소가 막혀도 메모리 저장으로 계속 동작한다", async () => {
  const blockedStorage: StoreModule.StorageLike = {
    getItem() {
      throw new Error("storage blocked");
    },
    setItem() {
      throw new Error("storage blocked");
    },
    removeItem() {
      throw new Error("storage blocked");
    },
  };
  const browserStore = createBrowserStore(blockedStorage);

  const family = await browserStore.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  const again = await browserStore.getOrCreateDemoFamily(FAMILY_A_VISITOR);

  assert.deepEqual(again, family);
});

test("방문자 ID는 브라우저 영구 저장소에서 다시 읽는다", () => {
  const storage = new FakeStorage();

  const first = getVisitorId(storage);
  const again = getVisitorId(storage);

  assert.equal(again, first);
  assert.notEqual(first, "");
});

test("기존 세션 방문자 ID를 영구 저장소로 옮겨 가족 기록 연결을 지킨다", () => {
  const durableStorage = new FakeStorage();
  const legacySessionStorage = new FakeStorage();
  legacySessionStorage.setItem("elly:visitor:v1", "legacy-visitor");

  const migrated = getVisitorId(durableStorage, legacySessionStorage);

  assert.equal(migrated, "legacy-visitor");
  assert.equal(durableStorage.getItem("elly:visitor:v1"), "legacy-visitor");
});

test("Supabase 연결 전에는 저장 모드를 memory로 알린다", () => {
  assert.equal(getStoreMode(), "memory");
});

test("두 가족이 같은 레코드 ID를 써도 서로의 데이터를 덮어쓰지 않는다", async () => {
  const store = createMemoryStore();
  const familyA = await store.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  const familyB = await store.getOrCreateDemoFamily(FAMILY_B_VISITOR);
  const sameId = "same-id";

  await store.saveMessage({
    id: sameId,
    familyId: familyA.id,
    from: "kid",
    text: "A의 메시지",
    createdAt: "2026-11-01T00:00:00.000Z",
  });
  await store.saveMessage({
    id: sameId,
    familyId: familyB.id,
    from: "kid",
    text: "B의 메시지",
    createdAt: "2026-11-01T00:00:00.000Z",
  });

  for (const [family, label] of [
    [familyA, "A"],
    [familyB, "B"],
  ] as const) {
    await store.saveQuestion({
      id: sameId,
      familyId: family.id,
      original: `${label}의 원래 질문`,
      rewritten: `${label}의 바꾼 질문`,
      createdAt: "2026-11-01T00:01:00.000Z",
    });
    await store.saveReply({
      id: sameId,
      familyId: family.id,
      questionId: sameId,
      answer: `${label}의 답`,
      summary: `${label}의 요약`,
      note: `${label}의 메모`,
      createdAt: "2026-11-01T00:02:00.000Z",
    });
    await store.saveAlert({
      id: sameId,
      familyId: family.id,
      quote: `${label}의 원문`,
      situation: `${label}의 상황`,
      guide: `${label}의 가이드`,
      riskType: "other",
      createdAt: "2026-11-01T00:03:00.000Z",
    });
    await store.saveShare({
      id: sameId,
      familyId: family.id,
      messageId: sameId,
      summary: `${label}의 공유`,
      status: "proposed",
      createdAt: "2026-11-01T00:04:00.000Z",
    });
  }

  await store.markQuestionAsked(familyA.id, sameId, "2026-11-01T00:05:00.000Z");
  await store.setShareStatus(familyA.id, sameId, "accepted");

  assert.equal((await store.getMessages(familyA.id))[0]?.text, "A의 메시지");
  assert.equal((await store.getMessages(familyB.id))[0]?.text, "B의 메시지");
  assert.equal((await store.getQuestions(familyA.id))[0]?.askedAt, "2026-11-01T00:05:00.000Z");
  assert.equal((await store.getQuestions(familyB.id))[0]?.askedAt, undefined);
  assert.deepEqual(
    (await store.getParentFeed(familyA.id)).map((item) => item.kind),
    ["share", "alert", "reply"],
  );
  assert.deepEqual(
    (await store.getParentFeed(familyB.id)).map((item) => item.kind),
    ["alert", "reply"],
  );
});

test("깨졌거나 이전 버전인 브라우저 저장값은 새 상태로 복구한다", async () => {
  const invalidStates = [
    {
      version: 1,
      familyIdByVisitor: {},
      families: [null],
      messages: [],
      questions: [],
      replies: [],
      alerts: [],
      shares: [],
    },
    { version: 0, families: [] },
  ];

  for (const [index, invalidState] of invalidStates.entries()) {
    const storage = new FakeStorage();
    storage.setItem("elly:store:v1", JSON.stringify(invalidState));
    const brokenStore = createBrowserStore(storage);

    const family = await brokenStore.getOrCreateDemoFamily(`visitor-invalid-${index}`);
    const recovered = JSON.parse(storage.getItem("elly:store:v1") ?? "null") as {
      version?: number;
      families?: unknown[];
    } | null;

    assert.equal(family.name, "준우네");
    assert.equal(recovered?.version, 1);
    assert.equal(recovered?.families?.length, 1);
  }
});

test("서버에서는 기본 브라우저 store와 방문자 ID를 공유하지 않는다", () => {
  assert.throws(() => getVisitorId(), /브라우저/);
  assert.throws(() => defaultStore.getOrCreateDemoFamily("server-visitor"), /브라우저/);
});

test("아이 대화 한 턴은 한 번의 변경 알림으로 모두 저장한다", async () => {
  const store = createMemoryStore();
  const family = await store.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  const question = {
    id: "question-atomic",
    familyId: family.id,
    original: "오늘 어땠어?",
    rewritten: "오늘 기억에 남는 일이 있었어?",
    createdAt: "2026-11-01T00:00:00.000Z",
  };
  await store.saveQuestion(question);
  let changes = 0;
  store.subscribe(() => {
    changes += 1;
  });

  await store.commitKidTurn({
    kidMessage: {
      id: "kid-atomic",
      familyId: family.id,
      from: "kid",
      text: "축구했어",
      createdAt: "2026-11-01T00:01:00.000Z",
    },
    kokkiriMessage: {
      id: "elly-atomic",
      familyId: family.id,
      from: "kokkiri",
      text: "재미있었겠다",
      createdAt: "2026-11-01T00:01:01.000Z",
    },
    answeredQuestionId: question.id,
    changedAt: "2026-11-01T00:01:02.000Z",
    reply: {
      id: "reply-atomic",
      familyId: family.id,
      questionId: question.id,
      answer: "축구했어",
      summary: "축구 이야기",
      note: "함께 이야기해 보세요",
      createdAt: "2026-11-01T00:01:02.000Z",
    },
  });

  assert.equal(changes, 1);
  assert.equal((await store.getMessages(family.id)).length, 2);
  assert.equal((await store.getQuestions(family.id))[0]?.answeredAt, "2026-11-01T00:01:02.000Z");
  assert.deepEqual((await store.getParentFeed(family.id)).map((item) => item.kind), ["reply"]);
});

test("없는 부모 질문 신호가 오면 대화 한 턴을 하나도 저장하지 않는다", async () => {
  const store = createMemoryStore();
  const family = await store.getOrCreateDemoFamily(FAMILY_A_VISITOR);

  await assert.rejects(
    store.commitKidTurn({
      kidMessage: {
        id: "kid-missing-question",
        familyId: family.id,
        from: "kid",
        text: "대답",
        createdAt: "2026-11-01T00:01:00.000Z",
      },
      kokkiriMessage: {
        id: "elly-missing-question",
        familyId: family.id,
        from: "kokkiri",
        text: "응답",
        createdAt: "2026-11-01T00:01:01.000Z",
      },
      answeredQuestionId: "missing-question",
      changedAt: "2026-11-01T00:01:02.000Z",
    }),
    /부모 질문/,
  );
  assert.deepEqual(await store.getMessages(family.id), []);
});

test("공유 거절은 제안과 원문을 한 번에 부모 제외 상태로 바꾼다", async () => {
  const store = createMemoryStore();
  const family = await store.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  await store.saveMessage({
    id: "share-source",
    familyId: family.id,
    from: "kid",
    text: "비밀 이야기",
    createdAt: "2026-11-01T00:00:00.000Z",
  });
  await store.saveShare({
    id: "share-proposal",
    familyId: family.id,
    messageId: "share-source",
    summary: "공유할 이야기",
    status: "proposed",
    createdAt: "2026-11-01T00:01:00.000Z",
  });

  await store.resolveShare(family.id, "share-proposal", "declined");

  assert.equal((await store.getMessages(family.id))[0]?.keepFromParent, "share_declined");
  assert.deepEqual(await store.getParentFeed(family.id), []);
});

async function saveKidTurns(
  activeStore: ReturnType<typeof createMemoryStore>,
  familyId: string,
  day: string,
  count: number,
) {
  for (let index = 0; index < count; index += 1) {
    await activeStore.saveMessage({
      id: `${familyId}-${day}-${index}`,
      familyId,
      from: "kid",
      text: `아이 말 ${index + 1}`,
      createdAt: `${day}T00:0${index}:00.000Z`,
    });
  }
}

test("아이 메시지가 3개보다 적으면 대화를 마쳐도 코인을 주지 않는다", async () => {
  const activeStore = createMemoryStore();
  const family = await activeStore.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  await saveKidTurns(activeStore, family.id, "2026-11-01", 2);

  const result = await activeStore.finishConversation(family.id, "2026-11-01T00:10:00.000Z");

  assert.deepEqual(result, { status: "too_short", coins: 0, awardedCoins: 0 });
  assert.equal((await activeStore.getOrCreateDemoFamily(FAMILY_A_VISITOR)).coins, 0);
});

test("실제 대화 2번 뒤 끝내기를 반복해도 종료 제어 메시지는 코인 기준에 포함하지 않는다", async () => {
  const activeStore = createMemoryStore();
  const family = await activeStore.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  await saveKidTurns(activeStore, family.id, "2026-11-01", 2);
  for (const [index, createdAt] of [
    "2026-11-01T00:03:00.000Z",
    "2026-11-01T00:04:00.000Z",
  ].entries()) {
    await activeStore.saveMessage({
      id: `finish-control-${index}`,
      familyId: family.id,
      from: "kid",
      text: "끝",
      createdAt,
    });
  }

  const result = await activeStore.finishConversation(family.id, "2026-11-01T00:05:00.000Z");

  assert.deepEqual(result, { status: "too_short", coins: 0, awardedCoins: 0 });
});

test("충분히 대화하면 10코인을 주고 같은 날 반복 종료는 다시 지급하지 않는다", async () => {
  const activeStore = createMemoryStore();
  const family = await activeStore.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  await saveKidTurns(activeStore, family.id, "2026-11-01", 3);

  const first = await activeStore.finishConversation(family.id, "2026-11-01T00:10:00.000Z");
  const repeated = await activeStore.finishConversation(family.id, "2026-11-01T00:11:00.000Z");

  assert.deepEqual(first, { status: "awarded", coins: 10, awardedCoins: 10 });
  assert.deepEqual(repeated, { status: "already_awarded", coins: 10, awardedCoins: 0 });
  assert.equal((await activeStore.getOrCreateDemoFamily(FAMILY_A_VISITOR)).coins, 10);
});

test("다음 날 다시 충분히 대화하면 코인을 한 번 더 받을 수 있다", async () => {
  const activeStore = createMemoryStore();
  const family = await activeStore.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  await saveKidTurns(activeStore, family.id, "2026-11-01", 3);
  await activeStore.finishConversation(family.id, "2026-11-01T00:10:00.000Z");
  await saveKidTurns(activeStore, family.id, "2026-11-02", 3);

  const nextDay = await activeStore.finishConversation(family.id, "2026-11-02T00:10:00.000Z");

  assert.deepEqual(nextDay, { status: "awarded", coins: 20, awardedCoins: 10 });
});

test("한국 자정 경계를 지나면 새 날짜의 대화로 코인을 다시 계산한다", async () => {
  const activeStore = createMemoryStore({ timezoneOffsetMinutes: -540 });
  const family = await activeStore.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  const messageTimes = [
    "2026-10-31T15:01:00.000Z",
    "2026-10-31T16:00:00.000Z",
    "2026-11-01T14:50:00.000Z",
    "2026-11-01T15:01:00.000Z",
    "2026-11-01T15:02:00.000Z",
    "2026-11-01T15:03:00.000Z",
  ];
  for (const [index, createdAt] of messageTimes.entries()) {
    await activeStore.saveMessage({
      id: `midnight-${index}`,
      familyId: family.id,
      from: "kid",
      text: `자정 경계 말 ${index + 1}`,
      createdAt,
    });
  }

  const beforeMidnight = await activeStore.finishConversation(
    family.id,
    "2026-11-01T14:59:00.000Z",
  );
  const afterMidnight = await activeStore.finishConversation(
    family.id,
    "2026-11-01T15:04:00.000Z",
  );

  assert.deepEqual(beforeMidnight, { status: "awarded", coins: 10, awardedCoins: 10 });
  assert.deepEqual(afterMidnight, { status: "awarded", coins: 20, awardedCoins: 10 });
});

test("가족마다 같은 날 코인을 한 번씩 받을 수 있다", async () => {
  const activeStore = createMemoryStore();
  const familyA = await activeStore.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  const familyB = await activeStore.getOrCreateDemoFamily(FAMILY_B_VISITOR);
  await saveKidTurns(activeStore, familyA.id, "2026-11-01", 3);
  await saveKidTurns(activeStore, familyB.id, "2026-11-01", 3);

  const resultA = await activeStore.finishConversation(familyA.id, "2026-11-01T00:10:00.000Z");
  const resultB = await activeStore.finishConversation(familyB.id, "2026-11-01T00:10:00.000Z");

  assert.equal(resultA.status, "awarded");
  assert.equal(resultB.status, "awarded");
  assert.equal((await activeStore.getOrCreateDemoFamily(FAMILY_A_VISITOR)).coins, 10);
  assert.equal((await activeStore.getOrCreateDemoFamily(FAMILY_B_VISITOR)).coins, 10);
});

test("브라우저 저장소를 다시 열어도 코인과 당일 지급 기록을 유지한다", async () => {
  const storage = new FakeStorage();
  const firstStore = createBrowserStore(storage);
  const family = await firstStore.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  for (let index = 0; index < 3; index += 1) {
    await firstStore.saveMessage({
      id: `persisted-kid-${index}`,
      familyId: family.id,
      from: "kid",
      text: `저장된 아이 말 ${index + 1}`,
      createdAt: `2026-11-01T00:0${index}:00.000Z`,
    });
  }
  await firstStore.finishConversation(family.id, "2026-11-01T00:10:00.000Z");

  const reopenedStore = createBrowserStore(storage);
  const repeated = await reopenedStore.finishConversation(family.id, "2026-11-01T00:11:00.000Z");

  assert.deepEqual(repeated, { status: "already_awarded", coins: 10, awardedCoins: 0 });
  assert.equal((await reopenedStore.getOrCreateDemoFamily(FAMILY_A_VISITOR)).coins, 10);
});

test("달력 기록은 요청한 가족 것만 날짜순으로 돌려준다", async () => {
  const activeStore = createMemoryStore();
  const familyA = await activeStore.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  const familyB = await activeStore.getOrCreateDemoFamily(FAMILY_B_VISITOR);
  const later: Entry = {
    id: "entry-a-later",
    familyId: familyA.id,
    date: "2026-11-02",
    type: "chat",
    ref: "conversation-a-later",
    diary: ["둘째 날 첫 줄", "둘째 날 둘째 줄", "둘째 날 셋째 줄"],
  };
  const earlier: Entry = {
    id: "entry-a-earlier",
    familyId: familyA.id,
    date: "2026-11-01",
    type: "chat",
    ref: "conversation-a-earlier",
    diary: ["첫째 날 첫 줄", "첫째 날 둘째 줄", "첫째 날 셋째 줄"],
  };
  const otherFamily: Entry = {
    id: "entry-b",
    familyId: familyB.id,
    date: "2026-11-01",
    type: "chat",
    ref: "conversation-b",
    diary: ["다른 가족 첫 줄", "다른 가족 둘째 줄", "다른 가족 셋째 줄"],
  };

  await activeStore.saveEntry(later);
  await activeStore.saveEntry(otherFamily);
  await activeStore.saveEntry(earlier);

  assert.deepEqual(await activeStore.getEntries(familyA.id), [earlier, later]);
  assert.deepEqual(await activeStore.getEntries(familyB.id), [otherFamily]);
});

test("같은 가족의 같은 날짜 대화 일기는 최신 기록 하나로 덮어쓴다", async () => {
  const activeStore = createMemoryStore();
  const family = await activeStore.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  const first: Entry = {
    id: "entry-first",
    familyId: family.id,
    date: "2026-11-01",
    type: "chat",
    ref: "conversation-first",
    diary: ["처음 첫 줄", "처음 둘째 줄", "처음 셋째 줄"],
  };
  const latest: Entry = {
    id: "entry-latest",
    familyId: family.id,
    date: "2026-11-01",
    type: "chat",
    ref: "conversation-latest",
    diary: ["최신 첫 줄", "최신 둘째 줄", "최신 셋째 줄"],
  };

  await activeStore.saveEntry(first);
  await activeStore.saveEntry(latest);

  assert.deepEqual(await activeStore.getEntries(family.id), [latest]);
});

test("브라우저 저장소를 다시 열어도 달력 일기를 복원한다", async () => {
  const storage = new FakeStorage();
  const firstStore = createBrowserStore(storage);
  const family = await firstStore.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  const entry: Entry = {
    id: "entry-persisted",
    familyId: family.id,
    date: "2026-11-01",
    type: "chat",
    ref: "conversation-persisted",
    diary: ["저장 첫 줄", "저장 둘째 줄", "저장 셋째 줄"],
  };
  await firstStore.saveEntry(entry);

  const reopenedStore = createBrowserStore(storage);

  assert.deepEqual(await reopenedStore.getEntries(family.id), [entry]);
});

test("아이 이름을 바꾸면 가족 이름도 함께 바뀌고 빈 이름은 무시한다", async () => {
  const store = createMemoryStore();
  const family = await store.getOrCreateDemoFamily(FAMILY_A_VISITOR);

  const renamed = await store.setKidName(family.id, "  민준  ");
  assert.equal(renamed.kidName, "민준");
  assert.equal(renamed.name, "민준네");
  assert.deepEqual(await store.getOrCreateDemoFamily(FAMILY_A_VISITOR), renamed);

  const unchanged = await store.setKidName(family.id, "   ");
  assert.equal(unchanged.kidName, "민준");
});

test("코인을 쓰면 줄고, 가진 것보다 많이 쓰거나 잘못된 수는 거절한다", async () => {
  const store = createMemoryStore();
  const family = await store.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  await assert.rejects(store.spendCoins(family.id, 10), /모자라/);
  const kidMessage = (id: string, createdAt: string): Message => ({ id, familyId: family.id, from: "kid", text: "놀았어", createdAt });
  for (const [i, at] of ["2026-11-01T00:00:00.000Z", "2026-11-01T00:01:00.000Z", "2026-11-01T00:02:00.000Z"].entries()) {
    await store.saveMessage(kidMessage(`kid-${i}`, at));
  }
  const finished = await store.finishConversation(family.id, "2026-11-01T00:03:00.000Z");
  assert.equal(finished.coins, 10);

  const after = await store.spendCoins(family.id, 7);
  assert.equal(after.coins, 3);
  await assert.rejects(store.spendCoins(family.id, 0), /올바르지/);
  await assert.rejects(store.spendCoins(family.id, 4), /모자라/);
});

test("맡긴 질문에 답했지만 전할 답이 없으면 내용 없이 '물어봤어요' 카드만, 위험 답이면 알림만", async () => {
  const store = createMemoryStore();
  const family = await store.getOrCreateDemoFamily(FAMILY_A_VISITOR);
  const question = (id: string): Question => ({
    id,
    familyId: family.id,
    original: "친구랑 잘 지내?",
    rewritten: "요즘 제일 재밌는 친구는 누구야?",
    createdAt: "2026-11-01T00:00:00.000Z",
  });
  await store.saveQuestion(question("q-quiet"));
  await store.commitKidTurn({
    kidMessage: { id: "kid-quiet", familyId: family.id, from: "kid", text: "엄마한테 말하지 마", createdAt: "2026-11-01T00:01:00.000Z", questionId: "q-quiet", keepFromParent: "dont_tell" },
    kokkiriMessage: { id: "elly-quiet", familyId: family.id, from: "kokkiri", text: "알겠어", createdAt: "2026-11-01T00:01:01.000Z" },
    answeredQuestionId: "q-quiet",
    changedAt: "2026-11-01T00:01:02.000Z",
  });
  const feed = await store.getParentFeed(family.id);
  assert.deepEqual(feed.map((item) => item.kind), ["quiet"]);
  assert.equal(JSON.stringify(feed).includes("엄마한테 말하지 마"), false);

  await store.saveQuestion(question("q-risk"));
  await store.commitKidTurn({
    kidMessage: { id: "kid-risk", familyId: family.id, from: "kid", text: "짝꿍이 때려", createdAt: "2026-11-01T00:02:00.000Z", questionId: "q-risk", category: "risk" },
    kokkiriMessage: { id: "elly-risk", familyId: family.id, from: "kokkiri", text: "말해 줘서 고마워", createdAt: "2026-11-01T00:02:01.000Z" },
    answeredQuestionId: "q-risk",
    changedAt: "2026-11-01T00:02:02.000Z",
    alert: { id: "alert-risk", familyId: family.id, quote: "짝꿍이 때려", situation: "친구 사이 다툼으로 보여요", guide: "천천히 들어 주세요", riskType: "violence", createdAt: "2026-11-01T00:02:02.000Z" },
  });
  assert.deepEqual((await store.getParentFeed(family.id)).map((item) => item.kind), ["alert", "quiet"]);
});
