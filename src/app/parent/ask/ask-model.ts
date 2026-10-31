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

export async function saveQuestionIfNonePending(
  target: Pick<EllyStore, "getPendingQuestion" | "saveQuestion">,
  proposal: Question,
): Promise<
  | { status: "saved"; question: Question }
  | { status: "already_pending"; question: Question }
> {
  const existing = await target.getPendingQuestion(proposal.familyId);
  if (existing) return { status: "already_pending", question: existing };
  await target.saveQuestion(proposal);
  return { status: "saved", question: proposal };
}
