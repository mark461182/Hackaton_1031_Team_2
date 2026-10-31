import type { IsoDate, IsoTime } from "./types";

const MINUTE_IN_MILLISECONDS = 60_000;

export function toLocalIsoDate(
  value: Date | IsoTime,
  timezoneOffsetMinutes?: number,
): IsoDate {
  const date = typeof value === "string" ? new Date(value) : value;
  const offset = timezoneOffsetMinutes ?? date.getTimezoneOffset();
  return new Date(date.getTime() - offset * MINUTE_IN_MILLISECONDS)
    .toISOString()
    .slice(0, 10) as IsoDate;
}

export function getLocalCalendarMonth(
  value: Date = new Date(),
  timezoneOffsetMinutes?: number,
): { year: number; monthIndex: number } {
  const [year, month] = toLocalIsoDate(value, timezoneOffsetMinutes).split("-").map(Number);
  return { year, monthIndex: month - 1 };
}
