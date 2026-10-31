import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type * as DateModule from "./date";

const require = createRequire(import.meta.url);
const { getLocalCalendarMonth, toLocalIsoDate } = require("./date.ts") as typeof DateModule;

test("한국 자정 기준으로 UTC 시각을 같은 날과 다음 날로 나눈다", () => {
  assert.equal(toLocalIsoDate("2026-11-01T14:59:59.000Z", -540), "2026-11-01");
  assert.equal(toLocalIsoDate("2026-11-01T15:00:00.000Z", -540), "2026-11-02");
});

test("UTC로는 전월이어도 한국에서는 다음 달이면 해당 달을 연다", () => {
  assert.deepEqual(
    getLocalCalendarMonth(new Date("2026-10-31T15:30:00.000Z"), -540),
    { year: 2026, monthIndex: 10 },
  );
});
