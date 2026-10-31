import type {
  Entry,
  Family,
  Id,
  IsoTime,
  KidDoneRequest,
  KidDoneResponse,
  Message,
} from "@/lib/types";
import { toLocalIsoDate } from "../../lib/date.ts";

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

export function selectDiaryMessages(
  messages: Message[],
  finishedAt: IsoTime,
  timezoneOffsetMinutes?: number,
): Message[] {
  const day = toLocalIsoDate(finishedAt, timezoneOffsetMinutes);
  return messages.filter(
    (message) =>
      toLocalIsoDate(message.createdAt, timezoneOffsetMinutes) === day &&
      message.createdAt <= finishedAt &&
      message.text.trim() !== "끝" &&
      !message.viaChoice,
  );
}

type CreateChatDiaryEntryInput = {
  familyId: Id;
  conversationId: Id;
  finishedAt: IsoTime;
  diary: string[];
  /** 예전 호출 호환용 (id는 날짜로 정한다) */
  nextId?: () => Id;
};

/** 하루에 일기 하나: 날짜로 id를 정해서 그날 대화를 마칠 때마다 같은 일기를 고쳐 쓴다 (가족 링크 동기화는 지우기를 못 옮겨서 id가 같아야 덮인다) */
export const chatDiaryEntryId = (date: string) => `chat-diary:${date}`;

export function createChatDiaryEntry({
  familyId,
  conversationId,
  finishedAt,
  diary,
}: CreateChatDiaryEntryInput): Entry {
  const date = toLocalIsoDate(finishedAt);
  return {
    id: chatDiaryEntryId(date),
    familyId,
    date,
    type: "chat",
    ref: conversationId,
    diary,
  };
}
