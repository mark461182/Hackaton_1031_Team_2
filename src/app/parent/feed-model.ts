import type { EllyStore, ParentFeedItem } from "../../lib/store";
import type { Family, Question } from "../../lib/types";

type ReplyEntry = Extract<ParentFeedItem, { kind: "reply" }> & {
  question: string;
  timeLabel: string;
};

type AlertEntry = Extract<ParentFeedItem, { kind: "alert" }> & {
  timeLabel: string;
};

type ShareEntry = Extract<ParentFeedItem, { kind: "share" }> & {
  timeLabel: string;
};

export type ParentFeedEntry = ReplyEntry | AlertEntry | ShareEntry;

export type ParentFeedData = {
  family: Family;
  entries: ParentFeedEntry[];
};

export function getParentFeedHeading(entryCount: number): string {
  return entryCount === 0 ? "소식을 기다려요" : "새 소식이 있어요";
}

const KIND_PRIORITY: Record<ParentFeedItem["kind"], number> = {
  alert: 0,
  reply: 1,
  share: 2,
};

const feedTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Seoul",
});

export function formatFeedTime(createdAt: string): string {
  const time = new Date(createdAt);
  if (Number.isNaN(time.getTime())) return "시간 정보 없음";
  return feedTimeFormatter.format(time);
}

export function buildParentFeedEntries(
  feed: ParentFeedItem[],
  questions: Question[],
): ParentFeedEntry[] {
  const questionById = new Map(questions.map((question) => [question.id, question]));

  return [...feed]
    .sort((left, right) => {
      const kindOrder = KIND_PRIORITY[left.kind] - KIND_PRIORITY[right.kind];
      if (kindOrder !== 0) return kindOrder;
      return right.createdAt.localeCompare(left.createdAt);
    })
    .map((item): ParentFeedEntry => {
      const timeLabel = formatFeedTime(item.createdAt);
      if (item.kind === "reply") {
        return {
          ...item,
          question: questionById.get(item.data.questionId)?.original ?? "아이에게 맡긴 질문",
          timeLabel,
        };
      }
      return { ...item, timeLabel };
    });
}

export async function loadParentFeedData(
  dataStore: EllyStore,
  visitorId: string,
): Promise<ParentFeedData> {
  const family = await dataStore.getOrCreateDemoFamily(visitorId);
  const [feed, questions] = await Promise.all([
    dataStore.getParentFeed(family.id),
    dataStore.getQuestions(family.id),
  ]);
  return { family, entries: buildParentFeedEntries(feed, questions) };
}
