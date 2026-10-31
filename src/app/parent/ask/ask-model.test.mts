import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type * as AskModel from "./ask-model";

const require = createRequire(import.meta.url);
const { MAX_PENDING_QUESTIONS, createQuestionFromAsk, parseParentAskResponse, pendingQueueLabel, saveQuestionIfRoom } = require("./ask-model.ts") as typeof AskModel;

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

test("대기 질문이 한도보다 적으면 줄 뒤에 더하고, 꽉 차면 저장하지 않는다", async () => {
  const make = (id: string) => ({
    id,
    familyId: "family-1",
    original: id,
    rewritten: id,
    createdAt: "2026-11-01T00:00:00.000Z",
  });
  const saved: string[] = [];
  const target = (pending: ReturnType<typeof make>[]) => ({
    getPendingQuestions: async () => pending,
    saveQuestion: async (question: { id: string }) => {
      saved.push(question.id);
    },
  });

  const added = await saveQuestionIfRoom(target([make("q1")]), make("q2"));
  assert.equal(added.status, "saved");
  assert.deepEqual(added.pending.map((q) => q.id), ["q1", "q2"]);

  const full = Array.from({ length: MAX_PENDING_QUESTIONS }, (_, i) => make(`old-${i}`));
  const refused = await saveQuestionIfRoom(target(full), make("q-new"));
  assert.equal(refused.status, "full");
  assert.deepEqual(saved, ["q2"]);
});

test("대기 줄 안내 문구", () => {
  assert.equal(pendingQueueLabel(2), "대기 중 2개, 아이가 편할 때 하나씩 물어볼게요");
  assert.equal(pendingQueueLabel(1), "아이가 편할 때 물어볼게요");
});
