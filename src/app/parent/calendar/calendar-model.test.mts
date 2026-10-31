import assert from "node:assert/strict";
import test from "node:test";

import type { Entry } from "../../../lib/types.ts";
import { createParentCalendarEntries } from "../../../data/parent-calendar.ts";
import {
  buildCalendarDays,
  chooseCalendarEntries,
  getEntriesForDate,
  shiftMonth,
} from "./calendar-model.ts";

const entries: Entry[] = [
  {
    id: "chat-1",
    familyId: "family-1",
    date: "2026-11-03",
    type: "chat",
    ref: "conversation-1",
    diary: ["친구와 운동장에서 놀았다.", "같이 뛰어서 신이 났다.", "내일도 만나고 싶다."],
  },
  {
    id: "photo-1",
    familyId: "family-1",
    date: "2026-11-03",
    type: "photo",
    ref: "/images/lunch.jpg",
  },
  {
    id: "chat-2",
    familyId: "family-1",
    date: "2026-10-31",
    type: "chat",
    ref: "conversation-2",
    diary: ["가족과 산책했다.", "낙엽 소리가 좋았다.", "다음에는 더 멀리 가고 싶다."],
  },
];

test("11월 달력은 일요일부터 42칸을 만들고 앞뒤 날짜를 밀리지 않게 놓는다", () => {
  const days = buildCalendarDays("2026-11", entries);

  assert.equal(days.length, 42);
  assert.deepEqual(
    [days[0].date, days[0].isCurrentMonth, days[41].date, days[41].isCurrentMonth],
    ["2026-11-01", true, "2026-12-12", false],
  );
});

test("같은 날 대화와 사진이 있으면 달력 칸에 두 표시를 모두 남긴다", () => {
  const day = buildCalendarDays("2026-11", entries).find(({ date }) => date === "2026-11-03");

  assert.deepEqual(
    day && { hasChat: day.hasChat, hasPhoto: day.hasPhoto, entryCount: day.entries.length },
    { hasChat: true, hasPhoto: true, entryCount: 2 },
  );
});

test("선택한 날짜의 기록만 입력 순서대로 돌려준다", () => {
  assert.deepEqual(
    getEntriesForDate(entries, "2026-11-03").map(({ id }) => id),
    ["chat-1", "photo-1"],
  );
  assert.deepEqual(getEntriesForDate(entries, "2026-11-04"), []);
});

test("이전과 다음 달 이동은 연도 경계를 정확히 넘는다", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
});

test("예시 기록은 기준일과 이틀 전의 대화·사진을 같은 가족 데이터로 만든다", () => {
  const sample = createParentCalendarEntries("family-7", new Date(2026, 10, 6, 12));

  assert.deepEqual(
    sample.map(({ familyId, date, type, diary }) => ({ familyId, date, type, diaryLines: diary?.length ?? 0 })),
    [
      { familyId: "family-7", date: "2026-11-06", type: "chat", diaryLines: 3 },
      { familyId: "family-7", date: "2026-11-04", type: "chat", diaryLines: 3 },
      { familyId: "family-7", date: "2026-11-04", type: "photo", diaryLines: 0 },
      { familyId: "family-7", date: "2026-11-01", type: "chat", diaryLines: 3 },
    ],
  );
});

test("저장된 가족 기록이 있으면 예시 기록 대신 실제 기록을 보여 준다", () => {
  const example = createParentCalendarEntries("family-1", new Date(2026, 10, 6, 12));

  assert.deepEqual(chooseCalendarEntries(entries, example), entries);
  assert.deepEqual(chooseCalendarEntries([], example), example);
});
