// 진짜 LLM으로 코끼리 응답 만들기 + 안전 규칙은 코드로 한 번 더 강제한다 (오픈소스 모델이 놓쳐도 지켜지게)
// LLM이 없거나 실패하면 mock.ts 가짜 응답으로 대체 → 데모 중에도 멈추지 않는다

import { chatComplete } from "./client";
import { ASK_AFTER_KID_TURNS, classify, mockKidChat, mockKidDone, mockParentAsk } from "./mock";
import {
  DIARY_SYSTEM,
  KID_SYSTEM,
  REWRITE_SYSTEM,
  buildDiary,
  buildKidTurn,
  buildRewrite,
  extractJson,
  parseKidTurn,
} from "./prompts";
import type {
  Involved,
  KidChatRequest,
  KidChatResponse,
  KidDoneRequest,
  KidDoneResponse,
  ParentAskRequest,
  ParentAskResponse,
  RiskType,
} from "@/lib/types";

const INVOLVED: Involved[] = ["none", "friend", "teacher", "family", "stranger", "other"];
const RISK_TYPES: RiskType[] = ["bullying", "violence", "self_harm", "adult_contact", "stranger", "neglect", "other"];
const DONT_TELL = /말하지\s?마|말\s?하지\s?마|말하면\s?안\s?돼|비밀이야|아무한테도\s?말/;

function quoteOf(text: string): string {
  const s = text.trim().split(/(?<=[.!?。])\s+/).slice(0, 2).join(" ");
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

export async function kidChat(req: KidChatRequest): Promise<KidChatResponse> {
  const q = req.pendingQuestion;
  const mustAskNow = Boolean(q && !q.askedAt && q.kidTurnsWaiting >= ASK_AFTER_KID_TURNS);
  const raw = await chatComplete(
    KID_SYSTEM,
    buildKidTurn({
      history: req.history,
      kidText: req.kidText,
      kidName: req.kidName,
      mission: q ? { question: q.rewritten, turns: q.kidTurnsWaiting, declines: 0, asked: Boolean(q.askedAt), mustAskNow } : null,
    }),
  );
  if (raw === null) return mockKidChat(req);

  const llm = parseKidTurn(raw, Boolean(q));
  const rule = classify(req.kidText); // 규칙 기반 판단 — 안전망

  // 분류: 규칙이 위험을 찾았으면 위험 (모델이 놓쳐도). 애매한 건 모델 판단
  const category = rule.category === "risk" ? "risk" : llm.category;
  const riskType: RiskType | undefined =
    category === "risk" ? (rule.riskType ?? (RISK_TYPES.includes(llm.riskType as RiskType) ? (llm.riskType as RiskType) : "other")) : undefined;
  // 가족이 당사자: 둘 중 하나라도 가족이라 보면 가족 (부모 알림을 만들지 않는 쪽)
  const llmInvolved = INVOLVED.includes(llm.involved as Involved) ? (llm.involved as Involved) : "none";
  const involved: Involved = rule.involved === "family" || llmInvolved === "family" ? "family" : llmInvolved !== "none" ? llmInvolved : rule.involved;
  const dontTell = llm.dontTell || DONT_TELL.test(req.kidText);

  let reply = llm.reply;
  let askedQuestionId: string | undefined;
  if (q && !q.askedAt) {
    if (llm.askedMission || reply.includes(q.rewritten)) askedQuestionId = q.id;
    else if (mustAskNow && category !== "risk") {
      // 몇 턴 안에 꼭 묻기: 모델이 안 물었으면 첫 문장 뒤에 붙인다
      const first = reply.split(/(?<=[.!?])\s+/)[0];
      reply = `${first} 그런데 나 궁금한 게 있어. ${q.rewritten}`;
      askedQuestionId = q.id;
    }
  }
  const answered = Boolean(q?.askedAt) && llm.mission && ["answered", "partial"].includes(llm.mission.status);
  const answeredQuestionId = answered ? q!.id : category === "risk" && q?.askedAt ? q.id : undefined;

  const res: KidChatResponse = {
    reply,
    choices: llm.choices,
    category,
    involved,
    riskType,
    keepFromParent: dontTell && category !== "risk" ? "dont_tell" : undefined,
    askedQuestionId,
    answeredQuestionId,
    endConversation: llm.endConversation,
  };

  if (category === "risk") {
    // 위험: 답장 카드 대신 알림 하나. 가족이 당사자면 알림 없음
    if (involved !== "family") {
      res.alert = {
        quote: quoteOf(req.kidText),
        situation: llm.parentSituation ?? "아이가 힘든 일을 겪고 있는 것 같아요",
        guide: llm.parentGuide ?? "혼내지 않을 거라고 먼저 말해 주고, 자세한 걸 한꺼번에 캐묻지 말고 천천히 들어 주세요",
        riskType: riskType ?? "other",
      };
    }
  } else if (answered && !dontTell) {
    res.replyCard = {
      questionId: q!.id,
      answer: req.kidText,
      summary: llm.parentSummary ?? llm.mission?.summary ?? "아이가 질문에 답했어요",
      note: llm.parentNote ?? "아이가 쓴 말을 그대로 받아서 저녁에 '그 얘기 더 해 줄래?'로 이어 보세요",
    };
  } else if (category === "share" && !dontTell && !askedQuestionId) {
    res.shareProposal = { summary: llm.mission?.summary || quoteOf(req.kidText) };
  }
  return res;
}

export async function parentAsk(req: ParentAskRequest): Promise<ParentAskResponse> {
  const raw = await chatComplete(REWRITE_SYSTEM, buildRewrite(req.text, req.kidName), { temperature: 0.4 });
  if (raw === null) return mockParentAsk(req);
  try {
    const data = extractJson(raw) as { missions?: { original?: string; kidQuestion?: string; whyChanged?: string }[] };
    const questions = (data.missions ?? [])
      .filter((m) => m.kidQuestion)
      .slice(0, 3)
      .map((m) => ({ original: m.original || req.text, rewritten: m.kidQuestion!, whyChanged: m.whyChanged || "" }));
    return questions.length ? { questions } : mockParentAsk(req);
  } catch {
    return mockParentAsk(req);
  }
}

export async function kidDone(req: KidDoneRequest): Promise<KidDoneResponse> {
  // "말하지 마"·[싫어]·위험 내용은 LLM에 보내기 전에 뺀다 (일기에 절대 안 들어가게)
  const lines = req.messages.filter((m) => m.from === "kid" && !m.keepFromParent && m.category !== "risk").map((m) => m.text);
  if (!lines.length) return mockKidDone(req);
  const raw = await chatComplete(DIARY_SYSTEM, buildDiary(lines, req.kidName), { temperature: 0.5, maxTokens: 300 });
  if (raw === null) return mockKidDone(req);
  try {
    const diary = ((extractJson(raw) as { diary?: unknown }).diary ?? []) as unknown[];
    const clean = diary.filter((d): d is string => typeof d === "string" && d.trim().length > 0).slice(0, 3);
    return clean.length === 3 ? { diary: clean } : mockKidDone(req);
  } catch {
    return mockKidDone(req);
  }
}
