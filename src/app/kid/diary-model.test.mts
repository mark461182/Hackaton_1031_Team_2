import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type * as DiaryModel from "./diary-model";
import type { Family, Message } from "../../../lib/types";

const require = createRequire(import.meta.url);
const {
  buildKidDoneRequest,
  createChatDiaryEntry,
  parseKidDoneResponse,
  selectDiaryMessages,
} = require("./diary-model.ts") as typeof DiaryModel;

const family: Family = {
  id: "family-1",
  name: "준우네",
  kidName: "준우",
  coins: 10,
  chargedWon: 0,
};

test("일기 요청은 아이 이름과 부모 제외 표시를 API 형식 그대로 보존한다", () => {
  const messages: Message[] = [
    {
      id: "kid-daily",
      familyId: family.id,
      from: "kid",
      text: "급식에 떡볶이가 나왔어",
      createdAt: "2026-11-01T00:00:00.000Z",
      category: "daily",
    },
    {
      id: "elly-reply",
      familyId: family.id,
      from: "kokkiri",
      text: "맛있었겠다",
      createdAt: "2026-11-01T00:00:01.000Z",
    },
    {
      id: "kid-private",
      familyId: family.id,
      from: "kid",
      text: "엄마한테 말하지 마",
      createdAt: "2026-11-01T00:01:00.000Z",
      category: "daily",
      keepFromParent: "dont_tell",
    },
  ];

  assert.deepEqual(buildKidDoneRequest(family, messages), {
    familyId: "family-1",
    kidName: "준우",
    messages: [
      {
        from: "kid",
        text: "급식에 떡볶이가 나왔어",
        category: "daily",
        keepFromParent: undefined,
      },
      {
        from: "kokkiri",
        text: "맛있었겠다",
        category: undefined,
        keepFromParent: undefined,
      },
      {
        from: "kid",
        text: "엄마한테 말하지 마",
        category: "daily",
        keepFromParent: "dont_tell",
      },
    ],
  });
});

test("일기 API 응답은 비어 있지 않은 정확히 3줄만 받는다", () => {
  const valid = {
    diary: ["오늘 친구와 놀았다.", "급식이 맛있었다.", "내일도 이야기해야지."],
    mock: true,
  };
  assert.deepEqual(parseKidDoneResponse(valid), valid);

  for (const invalid of [
    { diary: ["한 줄", "두 줄"] },
    { diary: ["한 줄", "두 줄", "세 줄", "네 줄"] },
    { diary: ["한 줄", "   ", "세 줄"] },
    { diary: valid.diary, mock: "yes" },
  ]) {
    assert.throws(() => parseKidDoneResponse(invalid), /잘못된 일기 응답/);
  }
});

test("검증한 3줄 일기를 종료 날짜의 대화 기록으로 만든다", () => {
  assert.deepEqual(
    createChatDiaryEntry({
      familyId: family.id,
      conversationId: "kid-finish-message",
      finishedAt: "2026-11-01T12:34:56.000Z",
      diary: ["첫 줄", "둘째 줄", "셋째 줄"],
      nextId: () => "entry-1",
    }),
    {
      id: "entry-1",
      familyId: "family-1",
      date: "2026-11-01",
      type: "chat",
      ref: "kid-finish-message",
      diary: ["첫 줄", "둘째 줄", "셋째 줄"],
    },
  );
});

test("일기에는 로컬 당일 대화만 담고 끝 버튼 메시지는 제외한다", () => {
  const messages: Message[] = [
    {
      id: "previous-local-day",
      familyId: family.id,
      from: "kid",
      text: "어제 이야기",
      createdAt: "2026-10-31T14:59:00.000Z",
    },
    {
      id: "today-message",
      familyId: family.id,
      from: "kid",
      text: "오늘 이야기",
      createdAt: "2026-10-31T15:01:00.000Z",
    },
    {
      id: "finish-message",
      familyId: family.id,
      from: "kid",
      text: "끝",
      createdAt: "2026-10-31T16:00:00.000Z",
    },
  ];

  assert.deepEqual(
    selectDiaryMessages(messages, "2026-10-31T16:00:00.000Z", "finish-message", -540).map(
      (message) => message.id,
    ),
    ["today-message"],
  );
});

test("다른 말로 대화가 끝났다면 마지막 아이 말도 일기에 남긴다", () => {
  const finalMessage: Message = {
    id: "meaningful-finish",
    familyId: family.id,
    from: "kid",
    text: "오늘은 여기까지 이야기할래",
    createdAt: "2026-11-01T12:00:00.000Z",
  };

  assert.deepEqual(
    selectDiaryMessages(
      [finalMessage],
      "2026-11-01T12:00:00.000Z",
      finalMessage.id,
      -540,
    ),
    [finalMessage],
  );
});
