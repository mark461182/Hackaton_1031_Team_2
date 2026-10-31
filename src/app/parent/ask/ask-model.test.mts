import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type * as AskModel from "./ask-model";

const require = createRequire(import.meta.url);
const { createQuestionFromAsk, parseParentAskResponse, saveQuestionIfNonePending } = require("./ask-model.ts") as typeof AskModel;

const response = {
  questions: [
    {
      original: "요즘 학교에서 누구랑 가장 많이 놀아?",
      rewritten: "오늘 학교에서 누구랑 놀았어? 같이 뭘 했는지도 궁금해!",
      whyChanged: "한 번에 떠올리기 쉬운 오늘 이야기로 바꿨어요.",
    },
  ],
  mock: true,
};

test("부모 질문 API 응답은 비어 있지 않은 질문 묶음만 받는다", () => {
  assert.deepEqual(parseParentAskResponse(response), response);
  assert.throws(() => parseParentAskResponse({ questions: [] }), /잘못된 질문 응답/);
  assert.throws(
    () => parseParentAskResponse({ questions: [{ original: "질문", rewritten: "", whyChanged: "이유" }] }),
    /잘못된 질문 응답/,
  );
});

test("첫 번째 다듬은 질문을 같은 가족의 대기 질문으로 만든다", () => {
  const question = createQuestionFromAsk(
    "family-1",
    response,
    "2026-11-01T01:00:00.000Z",
    () => "question-1",
  );

  assert.deepEqual(question, {
    id: "question-1",
    familyId: "family-1",
    original: response.questions[0].original,
    rewritten: response.questions[0].rewritten,
    whyChanged: response.questions[0].whyChanged,
    createdAt: "2026-11-01T01:00:00.000Z",
  });
});

test("화면을 연 뒤 다른 탭에서 질문을 맡겼으면 새 질문으로 덮어쓰지 않는다", async () => {
  const existing = {
    id: "question-existing",
    familyId: "family-1",
    original: "먼저 쓴 질문",
    rewritten: "오늘 어땠어?",
    createdAt: "2026-11-01T00:00:00.000Z",
  };
  const proposal = {
    id: "question-new",
    familyId: "family-1",
    original: "나중 질문",
    rewritten: "친구랑 뭐 했어?",
    createdAt: "2026-11-01T00:01:00.000Z",
  };
  let saved = false;

  const result = await saveQuestionIfNonePending(
    {
      getPendingQuestion: async () => existing,
      saveQuestion: async () => {
        saved = true;
      },
    },
    proposal,
  );

  assert.deepEqual(result, { status: "already_pending", question: existing });
  assert.equal(saved, false);
});
