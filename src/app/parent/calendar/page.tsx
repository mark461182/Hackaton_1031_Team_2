"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ParentBottomNav } from "../../../components/parent-feed";
import { createParentCalendarEntries } from "../../../data/parent-calendar";
import { createParentWeeklyReport } from "../../../data/parent-report";
import { getVisitorId, store } from "../../../lib/store";
import type { Entry, Family, IsoDate } from "../../../lib/types";

import {
  buildCalendarDays,
  chooseCalendarEntries,
  getEntriesForDate,
  shiftMonth,
  toIsoDate,
  toMonthKey,
} from "./calendar-model";
import { createParentReportPreview, getWeekRange } from "../report/report-model";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const fromIsoDate = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};

const formatMonth = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${year}년 ${monthNumber}월`;
};

const formatSelectedDate = (date: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(fromIsoDate(date));

export default function ParentCalendarPage() {
  const [anchorDate] = useState(() => new Date());
  const [family, setFamily] = useState<Family | null>(null);
  const [storedEntries, setStoredEntries] = useState<Entry[]>([]);
  const [month, setMonth] = useState(() => toMonthKey(anchorDate));
  const [selectedDate, setSelectedDate] = useState<IsoDate>(() => toIsoDate(anchorDate));
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    async function loadFamily() {
      try {
        const loadedFamily = await store.getOrCreateDemoFamily(getVisitorId());
        const refreshEntries = async (chooseInitialDate = false) => {
          const loadedEntries = await store.getEntries(loadedFamily.id);
          if (!active) return;
          setStoredEntries(loadedEntries);
          if (chooseInitialDate && loadedEntries.length > 0) {
            const today = toIsoDate(anchorDate);
            const selected = loadedEntries.some((entry) => entry.date === today)
              ? today
              : loadedEntries[loadedEntries.length - 1].date;
            setSelectedDate(selected);
            setMonth(selected.slice(0, 7));
          }
        };
        await refreshEntries(true);
        if (active) {
          setFamily(loadedFamily);
          setStatus("ready");
          unsubscribe = store.subscribe(() => {
            void refreshEntries();
          });
        }
      } catch {
        if (active) setStatus("error");
      }
    }
    void loadFamily();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [anchorDate]);

  const entries = useMemo(
    () => chooseCalendarEntries(
      storedEntries,
      family ? createParentCalendarEntries(family.id, anchorDate) : [],
    ),
    [anchorDate, family, storedEntries],
  );
  const days = useMemo(() => buildCalendarDays(month, entries), [entries, month]);
  const selectedEntries = useMemo(
    () => getEntriesForDate(entries, selectedDate),
    [entries, selectedDate],
  );
  const selectedChats = selectedEntries.filter((entry) => entry.type === "chat");
  const selectedPhotoCount = selectedEntries.filter((entry) => entry.type === "photo").length;
  const today = toIsoDate(anchorDate);
  const weekRange = useMemo(() => getWeekRange(anchorDate), [anchorDate]);
  const reportPreview = useMemo(() => {
    if (!family) return null;
    const report = createParentWeeklyReport(family.id, family.kidName, weekRange.start);
    return createParentReportPreview(report, weekRange.end);
  }, [family, weekRange.end, weekRange.start]);

  function moveMonth(amount: number) {
    const nextMonth = shiftMonth(month, amount);
    const nextDays = buildCalendarDays(nextMonth, entries);
    const firstRecordedDay = nextDays.find(
      (day) => day.isCurrentMonth && day.entries.length > 0,
    );
    setMonth(nextMonth);
    setSelectedDate(firstRecordedDay?.date ?? `${nextMonth}-01`);
  }

  function chooseDate(date: IsoDate) {
    setSelectedDate(date);
    if (date.slice(0, 7) !== month) setMonth(date.slice(0, 7));
  }

  return (
    <main className="min-h-dvh bg-[#F7F4EC] text-[#383D37]">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-x-hidden">
        <header className="grid min-h-[52px] grid-cols-[44px_1fr_44px] items-center px-5">
          <Link
            aria-label="부모 홈으로 돌아가기"
            className="flex min-h-11 items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#4F6F59]"
            href="/parent"
          >
            ←
          </Link>
          <h1 className="font-friendly text-center text-[20px]">가족 기록</h1>
          <span />
        </header>

        <div className="flex-1 px-5 pb-8 pt-3 tabular-nums">
          {status === "loading" ? (
            <div aria-busy="true" aria-live="polite">
              <span className="sr-only">가족 기록을 불러오는 중</span>
              <div className="h-9 w-32 rounded-xl bg-[#DCE3D9]" />
              <div className="mt-5 h-[326px] rounded-[20px] bg-white" />
              <div className="mt-4 h-48 rounded-[20px] bg-[#EEF0EA]" />
            </div>
          ) : null}

          {status === "error" ? (
            <section className="flex min-h-[60vh] flex-col items-center justify-center text-center" role="alert">
              <h2 className="font-friendly text-[22px]">기록을 불러오지 못했어요</h2>
              <p className="mt-3 text-[15px] leading-6 text-[#5E655C]">부모 홈으로 돌아갔다가 다시 열어 주세요.</p>
              <Link className="font-friendly mt-6 flex min-h-[52px] items-center rounded-2xl bg-[#4F6F59] px-6 text-white" href="/parent">
                부모 홈으로 돌아가기
              </Link>
            </section>
          ) : null}

          {status === "ready" ? (
            <>
              {reportPreview ? (
                <Link
                  aria-label="이번 주 리포트 전체 보기"
                  className="group mb-6 block rounded-[20px] bg-[#E8EEE5] px-5 py-5 outline-none transition-colors hover:bg-[#DFE9DC] focus-visible:ring-4 focus-visible:ring-[#AFC6AF]"
                  href={reportPreview.href}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[13px] tabular-nums text-[#5E655C]">{reportPreview.period}</p>
                      <h2 className="font-friendly mt-1 text-[19px] text-[#35523C]">이번 주 한눈에</h2>
                    </div>
                    <span aria-hidden="true" className="pt-1 text-[20px] text-[#4F6F59] transition-transform group-hover:translate-x-0.5">→</span>
                  </div>
                  <p className="mt-4 line-clamp-3 text-[15px] leading-6 text-[#4F5A4D]">{reportPreview.summary}</p>
                  <span className="font-friendly mt-4 block text-[14px] text-[#35523C]">주간 리포트 보기</span>
                </Link>
              ) : null}

              <section aria-labelledby="calendar-month-title">
                <div className="flex items-center justify-between">
                  <button
                    aria-label="이전 달 보기"
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[22px] outline-none hover:bg-[#E8EDE5] focus-visible:ring-2 focus-visible:ring-[#4F6F59]"
                    onClick={() => moveMonth(-1)}
                    type="button"
                  >
                    ‹
                  </button>
                  <h2 className="font-friendly text-[22px]" id="calendar-month-title">
                    {formatMonth(month)}
                  </h2>
                  <button
                    aria-label="다음 달 보기"
                    className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[22px] outline-none hover:bg-[#E8EDE5] focus-visible:ring-2 focus-visible:ring-[#4F6F59]"
                    onClick={() => moveMonth(1)}
                    type="button"
                  >
                    ›
                  </button>
                </div>

                <div className="mt-3 rounded-[20px] bg-white px-3 pb-4 pt-3">
                  <div aria-hidden="true" className="grid grid-cols-7 text-center text-[12px] text-[#667064]">
                    {WEEKDAYS.map((weekday) => (
                      <span className="py-2" key={weekday}>{weekday}</span>
                    ))}
                  </div>
                  <div aria-label={`${formatMonth(month)} 기록 달력`} className="grid grid-cols-7 gap-y-1">
                    {days.map((day) => {
                      const isSelected = day.date === selectedDate;
                      const isToday = day.date === today;
                      const recordNames = [day.hasChat ? "대화" : "", day.hasPhoto ? "사진" : ""].filter(Boolean).join(", ");
                      return (
                        <button
                          aria-label={`${day.date}${recordNames ? `, ${recordNames} 기록 있음` : ""}`}
                          aria-pressed={isSelected}
                          className={`relative flex min-h-11 min-w-0 flex-col items-center justify-center rounded-xl text-[14px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[#4F6F59] ${
                            isSelected
                              ? "bg-[#DCE8D8] font-semibold text-[#35523C]"
                              : day.isCurrentMonth
                                ? "text-[#383D37] hover:bg-[#F1F4EE]"
                                : "text-[#969B94] hover:bg-[#F7F4EC]"
                          }`}
                          key={day.date}
                          onClick={() => chooseDate(day.date)}
                          type="button"
                        >
                          <span className={isToday && !isSelected ? "font-semibold text-[#3F6147]" : ""}>{day.dayNumber}</span>
                          <span aria-hidden="true" className="mt-1 flex h-1.5 items-center gap-1">
                            {day.hasChat ? <span className="h-1.5 w-1.5 rounded-full bg-[#4F7FA6]" /> : null}
                            {day.hasPhoto ? <span className="h-1.5 w-1.5 rounded-full bg-[#B95D57]" /> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex justify-end gap-4 pr-1 text-[12px] text-[#5E655C]">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#4F7FA6]" />대화</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#B95D57]" />사진</span>
                  </div>
                </div>
              </section>

              <section aria-labelledby="selected-date-title" className="mt-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 className="font-friendly text-[20px]" id="selected-date-title">{formatSelectedDate(selectedDate)}</h2>
                    <p className="mt-1 text-[13px] text-[#5E655C]">{family?.kidName ?? "아이"}의 하루</p>
                  </div>
                  <p className="shrink-0 text-[13px] tabular-nums text-[#5E655C]">기록 {selectedEntries.length}개</p>
                </div>

                {selectedEntries.length === 0 ? (
                  <div className="mt-3 rounded-[20px] bg-[#EEF0EA] px-5 py-7 text-center">
                    <p className="font-friendly text-[16px]">이날은 아직 기록이 없어요</p>
                    <p className="mt-2 text-[14px] leading-6 text-[#5E655C]">대화를 마치면 3줄 일기가 여기에 모여요.</p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {selectedChats.map((entry) => (
                      <article className="rounded-[20px] bg-[#DCE8D8] p-5" key={entry.id}>
                        <h3 className="font-friendly text-[16px] text-[#3F6147]">오늘의 3줄 일기</h3>
                        <ol className="mt-4 space-y-3 text-[15px] leading-6">
                          {(entry.diary ?? []).map((line, index) => (
                            <li className="grid grid-cols-[24px_1fr] gap-2" key={`${entry.id}-${index}`}>
                              <span aria-hidden="true" className="tabular-nums text-[#667064]">{index + 1}.</span>
                              <span>{line}</span>
                            </li>
                          ))}
                        </ol>
                      </article>
                    ))}
                    {selectedPhotoCount > 0 ? (
                      <div className="flex min-h-[52px] items-center justify-between rounded-2xl bg-[#F9E3DF] px-4 text-[14px]">
                        <span className="font-medium text-[#6F403A]">사진으로 남긴 하루</span>
                        <span className="tabular-nums text-[#6F5A57]">{selectedPhotoCount}장</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>

        <ParentBottomNav active="record" />
      </div>
    </main>
  );
}
