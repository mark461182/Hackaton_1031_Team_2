import type {
  Entry,
  Family,
  Id,
  IsoTime,
  KidDoneRequest,
  KidDoneResponse,
  Message,
} from "@/lib/types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function buildKidDoneRequest(family: Family, messages: Message[]): KidDoneRequest {
  return {
    familyId: family.id,
    kidName: family.kidName,
    messages: messages.map(({ from, text, category, keepFromParent }) => ({
      from,
      text,
      category,
      keepFromParent,
    })),
  };
}

export function parseKidDoneResponse(value: unknown): KidDoneResponse {
  if (
    !isRecord(value) ||
    !Array.isArray(value.diary) ||
    value.diary.length !== 3 ||
    !value.diary.every((line) => typeof line === "string" && line.trim().length > 0) ||
    (value.mock !== undefined && typeof value.mock !== "boolean")
  ) {
    throw new Error("잘못된 일기 응답이에요");
  }
  return value as KidDoneResponse;
}

type CreateChatDiaryEntryInput = {
  familyId: Id;
  conversationId: Id;
  finishedAt: IsoTime;
  diary: string[];
  nextId: () => Id;
};

export function createChatDiaryEntry({
  familyId,
  conversationId,
  finishedAt,
  diary,
  nextId,
}: CreateChatDiaryEntryInput): Entry {
  return {
    id: nextId(),
    familyId,
    date: finishedAt.slice(0, 10),
    type: "chat",
    ref: conversationId,
    diary,
  };
}
