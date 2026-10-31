import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type * as CalendarModel from "./calendar-model";
import type { Entry } from "../../../../lib/types";

const require = createRequire(import.meta.url);
const { buildCalendarMonth, getVisibleCalendarDays, shiftCalendarMonth } = require(
  "./calendar-model.ts",
) as typeof CalendarModel;

test("2026년 8월은 앞 6칸과 뒤 5칸을 비운 42칸 달력이다", () => {
  const days = buildCalendarMonth(2026, 7, []);

  assert.equal(days.length, 42);
  assert.deepEqual(days.slice(0, 6).map((day) => day.dayNumber), [null, null, null, null, null, null]);
  assert.deepEqual(days[6], {
    date: "2026-08-01",
    dayNumber: 1,
    hasChat: false,
    entries: [],
  });
  assert.equal(days[36]?.dayNumber, 31);
  assert.deepEqual(days.slice(37).map((day) => day.dayNumber), [null, null, null, null, null]);
});

test("대화 기록이 있는 날짜만 파란 점 대상으로 표시한다", () => {
  const entries: Entry[] = [
    {
      id: "chat-1",
      familyId: "family-1",
      date: "2026-11-03",
      type: "chat",
      ref: "conversation-1",
      diary: ["첫 줄", "둘째 줄", "셋째 줄"],
    },
    {
      id: "photo-1",
      familyId: "family-1",
      date: "2026-11-04",
      type: "photo",
      ref: "photo-url",
    },
    {
      id: "chat-other-month",
      familyId: "family-1",
      date: "2026-12-03",
      type: "chat",
      ref: "conversation-2",
      diary: ["다른 달 첫 줄", "다른 달 둘째 줄", "다른 달 셋째 줄"],
    },
  ];

  const days = buildCalendarMonth(2026, 10, entries);
  const chatDay = days.find((day) => day.date === "2026-11-03");
  const photoDay = days.find((day) => day.date === "2026-11-04");

  assert.equal(chatDay?.hasChat, true);
  assert.deepEqual(chatDay?.entries, [entries[0]]);
  assert.equal(photoDay?.hasChat, false);
  assert.deepEqual(photoDay?.entries, [entries[1]]);
  assert.equal(days.some((day) => day.date === "2026-12-03"), false);
});

test("기록이 없는 달은 모든 날짜가 대화 없음 상태다", () => {
  const days = buildCalendarMonth(2026, 10, []);

  assert.equal(days.filter((day) => day.dayNumber !== null).length, 30);
  assert.equal(days.some((day) => day.hasChat), false);
});

test("달 이동은 1월과 12월의 연도 경계를 넘는다", () => {
  assert.deepEqual(shiftCalendarMonth({ year: 2026, monthIndex: 0 }, -1), {
    year: 2025,
    monthIndex: 11,
  });
  assert.deepEqual(shiftCalendarMonth({ year: 2026, monthIndex: 11 }, 1), {
    year: 2027,
    monthIndex: 0,
  });
});

test("마지막 주가 모두 빈칸이면 화면에서는 5주만 보여 준다", () => {
  const fiveWeekMonth = buildCalendarMonth(2026, 9, []);
  const sixWeekMonth = buildCalendarMonth(2026, 7, []);

  assert.equal(getVisibleCalendarDays(fiveWeekMonth).length, 35);
  assert.equal(getVisibleCalendarDays(sixWeekMonth).length, 42);
  assert.equal(getVisibleCalendarDays(fiveWeekMonth).at(-1)?.dayNumber, 31);
});
