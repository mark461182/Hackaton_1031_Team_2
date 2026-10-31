import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type * as ChatModel from "./chat-model";
import type { Family, KidChatResponse, Message, Question } from "../../lib/types";

const require = createRequire(import.meta.url);
const {
  buildKidChatRequest,
  buildPendingQuestion,
  createActionGate,
  createChatRecords,
  getFinishConversationNotice,
  getKidComposerAfterSend,
  getKidStagePresentation,
  getKidVoiceControlPresentation,
  parseKidChatResponse,
} = require("./chat-model.ts") as typeof ChatModel;

const family: Family = {
  id: "family-1",
  name: "준우네",
  kidName: "준우",
  coins: 0,
  chargedWon: 0,
};

test("아이 대화 상태를 서로 다른 Elly 이미지와 상태 문구로 만든다", () => {
  assert.deepEqual(getKidStagePresentation("ready", false), {
    asset: "greet",
    status: "안녕, 준우야!",
  });
  assert.deepEqual(getKidStagePresentation("listening", true), {
    asset: "listen",
    status: "응, 듣고 있어",
  });
  assert.deepEqual(getKidStagePresentation("thinking", true), {
    asset: "think",
    status: "잠깐만, 생각 중이야",
  });
  assert.deepEqual(getKidStagePresentation("speaking", true), {
    asset: "excited",
    status: "내 이야기도 들어 봐",
  });
  assert.deepEqual(getKidStagePresentation("ready", true), {
    asset: "greet",
    status: "더 들려줄래?",
  });
});

test("듣기·생각·말하기 상태는 음성 버튼 문구와 잠금 상태도 서로 다르다", () => {
  assert.deepEqual(getKidVoiceControlPresentation("listening", true), {
    label: "듣고 있어요 · 손을 떼면 확인",
    disabled: false,
  });
  assert.deepEqual(getKidVoiceControlPresentation("thinking", true), {
    label: "답을 생각하고 있어요",
    disabled: true,
  });
  assert.deepEqual(getKidVoiceControlPresentation("speaking", true), {
    label: "Elly가 말하고 있어요",
    disabled: true,
  });
});

test("전송 실패 뒤에는 작성 중인 말을 보존하고 성공 뒤에만 입력을 비운다", () => {
  const composer = {
    draft: "오늘 민수랑 놀았어",
    heardText: "오늘 민수랑 놀았어",
    interim: "오늘 민수랑",
    choices: ["더 말할래", "다른 이야기"],
  };

  assert.deepEqual(getKidComposerAfterSend(composer, { type: "failed" }), composer);
  assert.deepEqual(getKidComposerAfterSend(composer, { type: "succeeded", choices: ["좋아"] }), {
    draft: "",
    heardText: "",
    interim: "",
    choices: ["좋아"],
  });
});

test("대기 질문 이후 아이가 말한 횟수를 API 형식으로 만든다", () => {
  const question: Question = {
    id: "question-1",
    familyId: family.id,
    original: "학교는 어때?",
    rewritten: "오늘 학교에서 제일 웃겼던 일은 뭐야?",
    createdAt: "2026-11-01T00:01:00.000Z",
  };
  const messages: Message[] = [
    { id: "old", familyId: family.id, from: "kid", text: "예전 말", createdAt: "2026-11-01T00:00:00.000Z" },
    { id: "new-1", familyId: family.id, from: "kid", text: "첫 말", createdAt: "2026-11-01T00:02:00.000Z" },
    { id: "elly", familyId: family.id, from: "kokkiri", text: "API 답", createdAt: "2026-11-01T00:03:00.000Z" },
    { id: "new-2", familyId: family.id, from: "kid", text: "둘째 말", createdAt: "2026-11-01T00:04:00.000Z" },
  ];

  assert.deepEqual(buildPendingQuestion(question, messages), {
    id: question.id,
    rewritten: question.rewritten,
    kidTurnsWaiting: 2,
  });
  assert.equal(buildPendingQuestion(undefined, messages), null);
});

test("아이 대화 요청에는 최근 대화 10턴과 대기 질문만 담는다", () => {
  const question: Question = {
    id: "question-1",
    familyId: family.id,
    original: "친구는 어때?",
    rewritten: "오늘 누구랑 놀았어?",
    createdAt: "2026-11-01T00:00:00.000Z",
    askedAt: "2026-11-01T00:10:00.000Z",
  };
  const messages: Message[] = Array.from({ length: 12 }, (_, index) => ({
    id: `message-${index}`,
    familyId: family.id,
    from: index % 2 === 0 ? "kid" : "kokkiri",
    text: `대화 ${index}`,
    createdAt: `2026-11-01T00:${String(index).padStart(2, "0")}:00.000Z`,
  }));

  const request = buildKidChatRequest(family, messages, question, "방금 한 말");

  assert.equal(request.familyId, family.id);
  assert.equal(request.kidName, family.kidName);
  assert.equal(request.kidText, "방금 한 말");
  assert.equal(request.history.length, 10);
  assert.equal(request.history[0]?.text, "대화 2");
  assert.equal(request.history[9]?.text, "대화 11");
  assert.equal(request.pendingQuestion?.askedAt, question.askedAt);
});

test("API 응답을 분류된 아이 말과 elly 답·답장·공유 레코드로 바꾼다", () => {
  const kidMessage: Message = {
    id: "kid-1",
    familyId: family.id,
    from: "kid",
    text: "민수랑 놀았어",
    createdAt: "2026-11-01T00:00:00.000Z",
    confirmed: true,
  };
  const response: KidChatResponse = {
    reply: "API가 만든 답",
    choices: ["더 말할래"],
    category: "share",
    involved: "friend",
    keepFromParent: "dont_tell",
    answeredQuestionId: "question-1",
    replyCard: {
      questionId: "question-1",
      answer: "민수랑 놀았어",
      summary: "민수와 놀았다고 답했어요",
      note: "놀이 이야기를 이어 보세요",
    },
    shareProposal: { summary: "친구 이야기를 했어요" },
    endConversation: false,
  };
  const ids = ["elly-1", "reply-1", "share-1"];

  const records = createChatRecords({
    familyId: family.id,
    kidMessage,
    response,
    createdAt: "2026-11-01T00:01:00.000Z",
    nextId: () => ids.shift()!,
  });

  assert.equal(records.kidMessage.category, "share");
  assert.equal(records.kidMessage.involved, "friend");
  assert.equal(records.kidMessage.keepFromParent, "dont_tell");
  assert.equal(records.kidMessage.questionId, "question-1");
  assert.equal(records.kokkiriMessage.id, "elly-1");
  assert.equal(records.kokkiriMessage.text, response.reply);
  assert.equal(records.reply?.id, "reply-1");
  assert.equal(records.share?.id, "share-1");
  assert.equal(records.share?.status, "proposed");
});

test("위험 응답은 부모용 위험 알림 레코드로 바꾼다", () => {
  const kidMessage: Message = {
    id: "kid-1",
    familyId: family.id,
    from: "kid",
    text: "짝꿍이 때려",
    createdAt: "2026-11-01T00:00:00.000Z",
  };
  const response: KidChatResponse = {
    reply: "API가 만든 위험 답",
    choices: [],
    category: "risk",
    involved: "friend",
    riskType: "violence",
    alert: {
      quote: "짝꿍이 때려",
      situation: "누군가에게 맞는 일이 있었던 것 같아요",
      guide: "천천히 들어 주세요",
      riskType: "violence",
    },
    endConversation: false,
  };
  const ids = ["elly-1", "alert-1"];

  const records = createChatRecords({
    familyId: family.id,
    kidMessage,
    response,
    createdAt: "2026-11-01T00:01:00.000Z",
    nextId: () => ids.shift()!,
  });

  assert.equal(records.alert?.id, "alert-1");
  assert.equal(records.alert?.quote, "짝꿍이 때려");
  assert.equal(records.reply, undefined);
});

test("API 응답은 필수 필드와 선택지 개수를 검사한다", () => {
  const valid: KidChatResponse = {
    reply: "API 응답",
    choices: ["더 말할래"],
    category: "daily",
    involved: "none",
    endConversation: false,
    mock: true,
  };

  assert.deepEqual(parseKidChatResponse(valid), valid);
  assert.throws(
    () => parseKidChatResponse({ ...valid, choices: ["1", "2", "3", "4"] }),
    /잘못된 대화 응답/,
  );
  assert.throws(
    () => parseKidChatResponse({ ...valid, choices: "더 말할래" }),
    /잘못된 대화 응답/,
  );
});

test("가족 관련 위험 알림과 질문 ID가 다른 답장 카드를 거부한다", () => {
  const base = {
    reply: "API 응답",
    choices: [],
    category: "risk",
    involved: "family",
    riskType: "violence",
    endConversation: false,
  };
  assert.throws(
    () =>
      parseKidChatResponse({
        ...base,
        alert: { quote: "원문", situation: "상황", guide: "가이드", riskType: "violence" },
      }),
    /잘못된 대화 응답/,
  );
  assert.throws(
    () =>
      parseKidChatResponse({
        ...base,
        category: "daily",
        involved: "none",
        riskType: undefined,
        answeredQuestionId: "question-1",
        replyCard: {
          questionId: "question-2",
          answer: "답",
          summary: "요약",
          note: "메모",
        },
      }),
    /잘못된 대화 응답/,
  );
});

test("동작 잠금은 처리 중 두 번째 클릭을 막고 완료 뒤 다시 연다", () => {
  const gate = createActionGate();

  assert.equal(gate.tryEnter(), true);
  assert.equal(gate.tryEnter(), false);
  gate.leave();
  assert.equal(gate.tryEnter(), true);
});

test("코인을 받으면 받은 개수와 현재 코인을 함께 안내한다", () => {
  assert.deepEqual(
    getFinishConversationNotice({ status: "awarded", coins: 20, awardedCoins: 10 }),
    {
      tone: "success",
      text: "오늘 대화 코인 10개를 받았어요.",
      coins: 20,
    },
  );
});

test("대화가 짧으면 코인 없이 더 이야기해야 한다고 안내한다", () => {
  assert.deepEqual(
    getFinishConversationNotice({ status: "too_short", coins: 0, awardedCoins: 0 }),
    {
      tone: "neutral",
      text: "코인을 받으려면 이야기를 조금 더 나눠 주세요.",
      coins: 0,
    },
  );
});

test("오늘 이미 받았으면 현재 코인을 유지하고 중복 지급을 안내한다", () => {
  assert.deepEqual(
    getFinishConversationNotice({ status: "already_awarded", coins: 10, awardedCoins: 0 }),
    {
      tone: "neutral",
      text: "오늘 대화 코인은 이미 받았어요.",
      coins: 10,
    },
  );
});
