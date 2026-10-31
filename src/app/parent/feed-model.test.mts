import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type * as FeedModel from "./feed-model";
import type * as StoreModule from "../../lib/store";
import type { ParentFeedItem } from "../../lib/store";
import type { Question } from "../../lib/types";

const require = createRequire(import.meta.url);
const { buildParentFeedEntries, formatFeedTime, getParentFeedHeading, loadParentFeedData } = require("./feed-model.ts") as typeof FeedModel;
const { createMemoryStore } = require("../../lib/store.ts") as typeof StoreModule;

const FAMILY_ID = "family-1";

test("위험·답장·공유 순서로 묶고 같은 종류는 최신 소식부터 보여 준다", () => {
  const feed: ParentFeedItem[] = [
    {
      kind: "share",
      createdAt: "2026-11-01T00:04:00.000Z",
      data: {
        id: "share-1",
        familyId: FAMILY_ID,
        messageId: "message-1",
        summary: "친구와 화해한 이야기를 같이 전하고 싶어 했어요",
        status: "accepted",
        createdAt: "2026-11-01T00:04:00.000Z",
      },
    },
    {
      kind: "reply",
      createdAt: "2026-11-01T00:03:00.000Z",
      data: {
        id: "reply-new",
        familyId: FAMILY_ID,
        questionId: "question-new",
        answer: "민수랑 축구했어",
        summary: "민수와 축구를 했다고 답했어요",
        note: "저녁에 축구 이야기를 이어서 물어보세요",
        createdAt: "2026-11-01T00:03:00.000Z",
      },
    },
    {
      kind: "alert",
      createdAt: "2026-11-01T00:01:00.000Z",
      data: {
        id: "alert-1",
        familyId: FAMILY_ID,
        quote: "짝꿍이 맨날 때려",
        situation: "친구에게 맞는 일이 있었던 것 같아요",
        guide: "혼내지 않을 거라고 먼저 말해 주세요",
        riskType: "violence",
        createdAt: "2026-11-01T00:01:00.000Z",
      },
    },
    {
      kind: "reply",
      createdAt: "2026-11-01T00:02:00.000Z",
      data: {
        id: "reply-old",
        familyId: FAMILY_ID,
        questionId: "question-old",
        answer: "급식이 맛있었어",
        summary: "급식 이야기를 했어요",
        note: "좋아하는 메뉴를 물어보세요",
        createdAt: "2026-11-01T00:02:00.000Z",
      },
    },
  ];
  const questions: Question[] = [
    {
      id: "question-old",
      familyId: FAMILY_ID,
      original: "오늘 학교는 어땠어?",
      rewritten: "오늘 학교에서 제일 기억나는 일은 뭐야?",
      createdAt: "2026-11-01T00:00:00.000Z",
    },
    {
      id: "question-new",
      familyId: FAMILY_ID,
      original: "요즘 친구와 잘 지내?",
      rewritten: "요즘 같이 노는 친구 중에 제일 재밌는 친구는 누구야?",
      createdAt: "2026-11-01T00:00:30.000Z",
    },
  ];

  const entries = buildParentFeedEntries(feed, questions);

  assert.deepEqual(
    entries.map((entry) => [entry.kind, entry.data.id]),
    [
      ["alert", "alert-1"],
      ["reply", "reply-new"],
      ["reply", "reply-old"],
      ["share", "share-1"],
    ],
  );
  assert.equal(entries[1]?.kind === "reply" ? entries[1].question : undefined, "요즘 친구와 잘 지내?");
});

test("질문이나 날짜가 없어도 부모 피드를 안전한 문구로 만든다", () => {
  const feed: ParentFeedItem[] = [
    {
      kind: "reply",
      createdAt: "not-a-date",
      data: {
        id: "reply-orphan",
        familyId: FAMILY_ID,
        questionId: "missing-question",
        answer: "잘 모르겠어",
        summary: "아이가 아직 잘 모르겠다고 답했어요",
        note: "답을 재촉하지 말고 기다려 주세요",
        createdAt: "not-a-date",
      },
    },
  ];

  const [entry] = buildParentFeedEntries(feed, []);

  assert.equal(entry?.kind === "reply" ? entry.question : undefined, "아이에게 맡긴 질문");
  assert.equal(entry?.timeLabel, "시간 정보 없음");
  assert.equal(formatFeedTime("2026-11-01T00:03:00.000Z"), "11월 1일 09:03");
});

test("같은 방문자의 가족·질문·피드를 읽고 다시 불러오면 새 소식이 포함된다", async () => {
  const memoryStore = createMemoryStore();
  const family = await memoryStore.getOrCreateDemoFamily("visitor-parent");
  await memoryStore.saveQuestion({
    id: "question-1",
    familyId: family.id,
    original: "오늘 친구와 무슨 일이 있었어?",
    rewritten: "오늘 친구랑 놀 때 어떤 일이 있었어?",
    createdAt: "2026-11-01T00:00:00.000Z",
  });
  await memoryStore.saveReply({
    id: "reply-1",
    familyId: family.id,
    questionId: "question-1",
    answer: "민수랑 축구했어",
    summary: "민수와 축구를 했다고 답했어요",
    note: "축구 이야기를 이어서 물어보세요",
    createdAt: "2026-11-01T00:01:00.000Z",
  });

  const first = await loadParentFeedData(memoryStore, "visitor-parent");

  assert.equal(first.family.id, family.id);
  assert.equal(first.entries.length, 1);
  assert.equal(first.entries[0]?.kind === "reply" ? first.entries[0].question : undefined, "오늘 친구와 무슨 일이 있었어?");

  await memoryStore.saveAlert({
    id: "alert-1",
    familyId: family.id,
    quote: "짝꿍이 맨날 때려",
    situation: "친구에게 맞는 일이 있었던 것 같아요",
    guide: "혼내지 않을 거라고 먼저 말해 주세요",
    riskType: "violence",
    createdAt: "2026-11-01T00:02:00.000Z",
  });

  const reloaded = await loadParentFeedData(memoryStore, "visitor-parent");
  assert.deepEqual(reloaded.entries.map((entry) => entry.kind), ["alert", "reply"]);
});

test("피드를 읽지 못하면 로더가 오류를 호출자에게 돌려준다", async () => {
  const memoryStore = createMemoryStore();
  const failingStore: StoreModule.EllyStore = {
    ...memoryStore,
    async getParentFeed() {
      throw new Error("feed unavailable");
    },
  };

  await assert.rejects(loadParentFeedData(failingStore, "visitor-parent-error"), /feed unavailable/);
});

test("새 소식이 없을 때는 도착한 소식이 있다고 말하지 않는다", () => {
  assert.equal(getParentFeedHeading(0), "소식을 기다려요");
  assert.equal(getParentFeedHeading(2), "새 소식이 있어요");
});
