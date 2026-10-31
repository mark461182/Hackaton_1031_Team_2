import type {
  Alert,
  Family,
  Id,
  IsoTime,
  KidChatRequest,
  KidChatResponse,
  Message,
  PendingQuestion,
  Question,
  Reply,
  Share,
} from "@/lib/types";
import type { FinishConversationResult } from "@/lib/store";

const CATEGORIES = ["daily", "share", "risk"] as const;
const INVOLVED = ["none", "friend", "teacher", "family", "stranger", "other"] as const;
const RISK_TYPES = ["bullying", "violence", "self_harm", "adult_contact", "stranger", "neglect", "other"] as const;
const KEEP_REASONS = ["dont_tell", "share_declined"] as const;

export type KidScreenState = "loading" | "ready" | "listening" | "thinking" | "speaking";
export type EllyAsset = "greet" | "listen" | "think" | "excited" | "cry";
export type FinishConversationNotice = {
  tone: "success" | "neutral";
  text: string;
  coins: number;
};
export type KidComposerState = {
  draft: string;
  heardText: string;
  interim: string;
  choices: string[];
};
export type KidSendOutcome =
  | { type: "failed" }
  | { type: "succeeded"; choices: string[] };

export function getFinishConversationNotice(
  result: FinishConversationResult,
): FinishConversationNotice {
  if (result.status === "awarded") {
    return {
      tone: "success",
      text: `오늘 대화 코인 ${result.awardedCoins}개를 받았어요.`,
      coins: result.coins,
    };
  }
  if (result.status === "too_short") {
    return {
      tone: "neutral",
      text: "코인을 받으려면 이야기를 조금 더 나눠 주세요.",
      coins: result.coins,
    };
  }
  return {
    tone: "neutral",
    text: "오늘 대화 코인은 이미 받았어요.",
    coins: result.coins,
  };
}

export function getKidStagePresentation(
  state: KidScreenState,
  started: boolean,
): { asset: EllyAsset; status: string } {
  if (state === "listening") return { asset: "listen", status: "응, 듣고 있어" };
  if (state === "thinking" || state === "loading") {
    return { asset: "think", status: state === "loading" ? "대화를 준비하고 있어" : "잠깐만, 생각 중이야" };
  }
  if (state === "speaking") return { asset: "excited", status: "내 이야기도 들어 봐" };
  return started
    ? { asset: "greet", status: "더 들려줄래?" }
    : { asset: "greet", status: "안녕, 준우야!" };
}

export function getKidVoiceControlPresentation(
  state: KidScreenState,
  sttSupported: boolean,
): { label: string; disabled: boolean } {
  if (state === "listening") {
    return { label: "듣고 있어요 · 손을 떼면 확인", disabled: false };
  }
  if (state === "thinking" || state === "loading") {
    return { label: "답을 생각하고 있어요", disabled: true };
  }
  if (state === "speaking") {
    return { label: "Elly가 말하고 있어요", disabled: true };
  }
  if (!sttSupported) {
    return { label: "마이크 미지원 · 글자로 말해 주세요", disabled: true };
  }
  return { label: "꾹 누르고 말하기", disabled: false };
}

export function getKidComposerAfterSend(
  current: KidComposerState,
  outcome: KidSendOutcome,
): KidComposerState {
  if (outcome.type === "failed") return current;
  return {
    draft: "",
    heardText: "",
    interim: "",
    choices: outcome.choices,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === "string";
const isOneOf = <T extends string>(value: unknown, values: readonly T[]): value is T =>
  typeof value === "string" && values.includes(value as T);

const invalidResponse = (): never => {
  throw new Error("잘못된 대화 응답이에요");
};

export function parseKidChatResponse(value: unknown): KidChatResponse {
  if (!isRecord(value)) throw new Error("잘못된 대화 응답이에요");
  if (
    !isNonEmptyString(value.reply) ||
    !Array.isArray(value.choices) ||
    value.choices.length > 3 ||
    !value.choices.every(isNonEmptyString) ||
    !isOneOf(value.category, CATEGORIES) ||
    !isOneOf(value.involved, INVOLVED) ||
    typeof value.endConversation !== "boolean" ||
    (value.mock !== undefined && typeof value.mock !== "boolean") ||
    !isOptionalString(value.askedQuestionId) ||
    !isOptionalString(value.answeredQuestionId) ||
    (value.riskType !== undefined && !isOneOf(value.riskType, RISK_TYPES)) ||
    (value.keepFromParent !== undefined && !isOneOf(value.keepFromParent, KEEP_REASONS))
  ) {
    invalidResponse();
  }

  const replyCard = value.replyCard;
  if (
    replyCard !== undefined &&
    (!isRecord(replyCard) ||
      !isNonEmptyString(replyCard.questionId) ||
      !isNonEmptyString(replyCard.answer) ||
      !isNonEmptyString(replyCard.summary) ||
      !isNonEmptyString(replyCard.note))
  ) {
    invalidResponse();
  }

  const alert = value.alert;
  if (
    alert !== undefined &&
    (!isRecord(alert) ||
      !isNonEmptyString(alert.quote) ||
      !isNonEmptyString(alert.situation) ||
      !isNonEmptyString(alert.guide) ||
      !isOneOf(alert.riskType, RISK_TYPES))
  ) {
    invalidResponse();
  }

  const shareProposal = value.shareProposal;
  if (
    shareProposal !== undefined &&
    (!isRecord(shareProposal) || !isNonEmptyString(shareProposal.summary))
  ) {
    invalidResponse();
  }

  if (
    (value.category === "risk" && value.riskType === undefined) ||
    (value.category !== "risk" && value.riskType !== undefined) ||
    (isRecord(replyCard) && isRecord(alert)) ||
    (isRecord(replyCard) &&
      (value.answeredQuestionId === undefined || replyCard.questionId !== value.answeredQuestionId)) ||
    (isRecord(alert) &&
      (value.category !== "risk" || value.involved === "family" || alert.riskType !== value.riskType)) ||
    (shareProposal !== undefined &&
      (value.category !== "share" || value.keepFromParent === "dont_tell"))
  ) {
    invalidResponse();
  }

  return value as KidChatResponse;
}

export function createActionGate() {
  let entered = false;
  return {
    tryEnter() {
      if (entered) return false;
      entered = true;
      return true;
    },
    leave() {
      entered = false;
    },
  };
}

export function buildPendingQuestion(question: Question | undefined, messages: Message[]): PendingQuestion | null {
  if (!question) return null;
  const kidTurnsWaiting = messages.filter(
    (message) => message.from === "kid" && message.createdAt > question.createdAt,
  ).length;
  return {
    id: question.id,
    rewritten: question.rewritten,
    ...(question.askedAt ? { askedAt: question.askedAt } : {}),
    kidTurnsWaiting,
  };
}

export function buildKidChatRequest(
  family: Family,
  messages: Message[],
  question: Question | undefined,
  kidText: string,
): KidChatRequest {
  return {
    familyId: family.id,
    kidName: family.kidName,
    kidText,
    history: messages.slice(-10).map(({ from, text }) => ({ from, text })),
    pendingQuestion: buildPendingQuestion(question, messages),
  };
}

export type ChatRecords = {
  kidMessage: Message;
  kokkiriMessage: Message;
  reply?: Reply;
  alert?: Alert;
  share?: Share;
};

type CreateChatRecordsInput = {
  familyId: Id;
  kidMessage: Message;
  response: KidChatResponse;
  createdAt: IsoTime;
  nextId: () => Id;
};

export function createChatRecords({
  familyId,
  kidMessage,
  response,
  createdAt,
  nextId,
}: CreateChatRecordsInput): ChatRecords {
  const classifiedKidMessage: Message = {
    ...kidMessage,
    category: response.category,
    involved: response.involved,
    keepFromParent: response.keepFromParent,
    questionId: response.answeredQuestionId,
  };
  const kokkiriMessage: Message = {
    id: nextId(),
    familyId,
    from: "kokkiri",
    text: response.reply,
    createdAt,
    questionId: response.askedQuestionId,
  };
  const reply: Reply | undefined = response.replyCard
    ? { ...response.replyCard, id: nextId(), familyId, createdAt }
    : undefined;
  const alert: Alert | undefined = response.alert
    ? { ...response.alert, id: nextId(), familyId, createdAt }
    : undefined;
  const share: Share | undefined = response.shareProposal
    ? {
        id: nextId(),
        familyId,
        messageId: kidMessage.id,
        summary: response.shareProposal.summary,
        status: "proposed",
        createdAt,
      }
    : undefined;

  return { kidMessage: classifiedKidMessage, kokkiriMessage, reply, alert, share };
}
