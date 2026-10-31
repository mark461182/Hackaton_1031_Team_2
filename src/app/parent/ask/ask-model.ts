import type { Id, IsoTime, ParentAskResponse, Question } from "@/lib/types";
import type { EllyStore } from "@/lib/store";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export function parseParentAskResponse(value: unknown): ParentAskResponse {
  if (!isRecord(value) || !Array.isArray(value.questions) || value.questions.length === 0) {
    throw new Error("잘못된 질문 응답이에요");
  }

  const validQuestions = value.questions.every(
    (question) =>
      isRecord(question) &&
      isNonEmptyString(question.original) &&
      isNonEmptyString(question.rewritten) &&
      isNonEmptyString(question.whyChanged),
  );
  if (!validQuestions || (value.mock !== undefined && typeof value.mock !== "boolean")) {
    throw new Error("잘못된 질문 응답이에요");
  }

  return value as ParentAskResponse;
}

export function createQuestionFromAsk(
  familyId: Id,
  response: ParentAskResponse,
  createdAt: IsoTime,
  nextId: () => Id,
): Question {
  const first = response.questions[0];
  if (!first) throw new Error("저장할 질문이 없어요");
  return {
    id: nextId(),
    familyId,
    original: first.original,
    rewritten: first.rewritten,
    whyChanged: first.whyChanged,
    createdAt,
  };
}

/** 한꺼번에 맡길 수 있는 질문 수 (대화 한 번에 하나씩 물으니 너무 쌓이면 아이에게 늦게 간다) */
export const MAX_PENDING_QUESTIONS = 3;

export async function saveQuestionIfRoom(
  target: Pick<EllyStore, "getPendingQuestions" | "saveQuestion">,
  proposal: Question,
): Promise<{ status: "saved" | "full"; pending: Question[] }> {
  const pending = await target.getPendingQuestions(proposal.familyId);
  if (pending.length >= MAX_PENDING_QUESTIONS) return { status: "full", pending };
  await target.saveQuestion(proposal);
  return { status: "saved", pending: [...pending, proposal] };
}

export function pendingQueueLabel(count: number): string {
  return count > 1 ? `대기 중 ${count}개, 아이가 편할 때 하나씩 물어볼게요` : "아이가 편할 때 물어볼게요";
}

/** 대기 줄의 각 질문 상태 (첫 번째만 지금 물어보는 질문) */
export function questionStatusLabel(question: Question, index: number): string {
  if (question.askedAt) return "지금 물어보는 중";
  if (question.deferredAt) return "다음 대화에 다시 물어볼게요";
  return index === 0 ? "다음 대화에서 물어볼게요" : `${index + 1}번째로 물어볼게요`;
}
