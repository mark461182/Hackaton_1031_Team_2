import type { Entry, IsoDate } from "../../../lib/types";

export type CalendarDay = {
  date: IsoDate;
  dayNumber: number;
  isCurrentMonth: boolean;
  hasChat: boolean;
  hasPhoto: boolean;
  entries: Entry[];
};

const parseMonth = (month: string): { year: number; monthIndex: number } => {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) throw new Error("월은 YYYY-MM 형식이어야 해요");
  return { year: Number(match[1]), monthIndex: Number(match[2]) - 1 };
};

export const toIsoDate = (date: Date): IsoDate => {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const toMonthKey = (date: Date): string => toIsoDate(date).slice(0, 7);

export function getEntriesForDate(entries: Entry[], date: IsoDate): Entry[] {
  return entries.filter((entry) => entry.date === date);
}

export function chooseCalendarEntries(storedEntries: Entry[], exampleEntries: Entry[]): Entry[] {
  return storedEntries.length > 0 ? storedEntries : exampleEntries;
}

export function buildCalendarDays(month: string, entries: Entry[]): CalendarDay[] {
  const { year, monthIndex } = parseMonth(month);
  const firstDay = new Date(year, monthIndex, 1, 12);
  const gridStart = new Date(year, monthIndex, 1 - firstDay.getDay(), 12);
  const daysInMonth = new Date(year, monthIndex + 1, 0, 12).getDate();
  // 다음 달만 있는 줄은 그리지 않는다 (11/1 도하: 흐린 12월 줄 빼기)
  const weeks = Math.ceil((firstDay.getDay() + daysInMonth) / 7);

  return Array.from({ length: weeks * 7 }, (_, index) => {
    const dateValue = new Date(gridStart);
    dateValue.setDate(gridStart.getDate() + index);
    const date = toIsoDate(dateValue);
    const dayEntries = getEntriesForDate(entries, date);

    return {
      date,
      dayNumber: dateValue.getDate(),
      isCurrentMonth: dateValue.getMonth() === monthIndex,
      hasChat: dayEntries.some((entry) => entry.type === "chat"),
      hasPhoto: dayEntries.some((entry) => entry.type === "photo"),
      entries: dayEntries,
    };
  });
}

export function shiftMonth(month: string, amount: number): string {
  const { year, monthIndex } = parseMonth(month);
  return toMonthKey(new Date(year, monthIndex + amount, 1, 12));
}
