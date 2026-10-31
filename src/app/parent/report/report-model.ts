import type { IsoDate } from "../../../lib/types";
import type { ParentWeeklyReport } from "../../../data/parent-report";

const toIsoDate = (date: Date): IsoDate => {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (date: IsoDate) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};

export function getWeekRange(anchorDate: Date): { start: IsoDate; end: IsoDate } {
  const anchor = new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth(),
    anchorDate.getDate(),
    12,
  );
  const daysFromMonday = (anchor.getDay() + 6) % 7;
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - daysFromMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function formatWeekRange(start: IsoDate, end: IsoDate): string {
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end);
  const startLabel = `${startDate.getMonth() + 1}월 ${startDate.getDate()}일`;
  const endLabel = `${endDate.getMonth() + 1}월 ${endDate.getDate()}일`;

  if (startDate.getFullYear() === endDate.getFullYear()) {
    return `${startLabel} – ${endLabel}`;
  }

  return `${startDate.getFullYear()}년 ${startLabel} – ${endDate.getFullYear()}년 ${endLabel}`;
}

export function createParentReportPreview(report: ParentWeeklyReport, end: IsoDate) {
  return {
    period: formatWeekRange(report.week, end),
    summary: report.summary,
    href: "/parent/report",
  };
}
