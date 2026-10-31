import type { Entry, IsoDate } from "@/lib/types";

export type KidCalendarDay = {
  date: IsoDate | null;
  dayNumber: number | null;
  hasChat: boolean;
  entries: Entry[];
};

export type CalendarMonth = {
  year: number;
  monthIndex: number;
};

const toIsoDate = (year: number, monthIndex: number, day: number): IsoDate =>
  `${String(year).padStart(4, "0")}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

export function buildCalendarMonth(
  year: number,
  monthIndex: number,
  entries: Entry[],
): KidCalendarDay[] {
  const leadingBlanks = new Date(year, monthIndex, 1, 12).getDay();
  const dayCount = new Date(year, monthIndex + 1, 0, 12).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const dayNumber = index - leadingBlanks + 1;
    if (dayNumber < 1 || dayNumber > dayCount) {
      return { date: null, dayNumber: null, hasChat: false, entries: [] };
    }

    const date = toIsoDate(year, monthIndex, dayNumber);
    const dayEntries = entries.filter((entry) => entry.date === date);
    return {
      date,
      dayNumber,
      hasChat: dayEntries.some((entry) => entry.type === "chat"),
      entries: dayEntries,
    };
  });
}

export function shiftCalendarMonth(month: CalendarMonth, amount: number): CalendarMonth {
  const shifted = new Date(month.year, month.monthIndex + amount, 1, 12);
  return { year: shifted.getFullYear(), monthIndex: shifted.getMonth() };
}

export function getVisibleCalendarDays(days: KidCalendarDay[]): KidCalendarDay[] {
  return days.slice(35).some((day) => day.date !== null) ? days : days.slice(0, 35);
}
