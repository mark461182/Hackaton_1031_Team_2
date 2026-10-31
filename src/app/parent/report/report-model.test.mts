import assert from "node:assert/strict";
import test from "node:test";

import { createParentWeeklyReport } from "../../../data/parent-report.ts";
import {
  createParentReportPreview,
  formatWeekRange,
  getWeekRange,
} from "./report-model.ts";

test("일요일이 기준일이어도 그 주 월요일부터 일요일까지 계산한다", () => {
  const range = getWeekRange(new Date(2026, 10, 1, 12));

  assert.deepEqual(range, {
    start: "2026-10-26",
    end: "2026-11-01",
  });
});

test("연도가 바뀌는 주간 범위는 양쪽 연도를 모두 표시한다", () => {
  assert.equal(
    formatWeekRange("2025-12-29", "2026-01-04"),
    "2025년 12월 29일 – 2026년 1월 4일",
  );
});

test("가족별 리포트는 가족 ID와 아이 이름을 서로 섞지 않는다", () => {
  const junwoo = createParentWeeklyReport("family-junwoo", "준우", "2026-10-26");
  const yuna = createParentWeeklyReport("family-yuna", "유나", "2026-10-26");

  assert.equal(junwoo.familyId, "family-junwoo");
  assert.equal(yuna.familyId, "family-yuna");
  assert.notEqual(junwoo.id, yuna.id);
  assert.match(junwoo.summary, /준우/);
  assert.doesNotMatch(junwoo.summary, /유나/);
  assert.match(yuna.summary, /유나/);
  assert.doesNotMatch(yuna.summary, /준우/);
});

test("다음 주 추천은 열린 질문 세 개를 제공한다", () => {
  const report = createParentWeeklyReport(
    "family-junwoo",
    "준우",
    "2026-10-26",
  );

  assert.equal(report.nextQuestions.length, 3);
  assert.ok(report.nextQuestions.every((question) => question.endsWith("?")));
  assert.ok(report.nextQuestions.every((question) => !/했지\?|맞지\?/.test(question)));
});

test("달력 미리보기는 같은 주간 문구와 전체 리포트 주소를 제공한다", () => {
  const report = createParentWeeklyReport("family-junwoo", "준우", "2026-10-26");

  assert.deepEqual(createParentReportPreview(report, "2026-11-01"), {
    period: "10월 26일 – 11월 1일",
    summary: report.summary,
    href: "/parent/report",
  });
});
