"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getVisitorId, store } from "@/lib/store";
import type { Entry, Family, IsoDate } from "@/lib/types";

import {
  buildCalendarMonth,
  getVisibleCalendarDays,
  shiftCalendarMonth,
  type CalendarMonth,
} from "./calendar-model";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const getCurrentMonth = (): CalendarMonth => {
  const current = new Date();
  return { year: current.getUTCFullYear(), monthIndex: current.getUTCMonth() };
};

const formatDiaryDate = (date: IsoDate): string => {
  const [, month, day] = date.split("-");
  return `${Number(month)}월 ${Number(day)}일의 기록`;
};

export default function KidCalendarPage() {
  const [family, setFamily] = useState<Family | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [month, setMonth] = useState<CalendarMonth>(getCurrentMonth);
  const [selectedDate, setSelectedDate] = useState<IsoDate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    async function load() {
      setLoading(true);
      setError("");
      try {
        const loadedFamily = await store.getOrCreateDemoFamily(getVisitorId());
        const refresh = async () => {
          const savedEntries = await store.getEntries(loadedFamily.id);
          if (active) setEntries(savedEntries);
        };
        await refresh();
        if (!active) return;
        setFamily(loadedFamily);
        setLoading(false);
        unsubscribe = store.subscribe(() => void refresh());
      } catch {
        if (active) {
          setError("기록을 불러오지 못했어요.");
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadVersion]);

  const days = useMemo(
    () => buildCalendarMonth(month.year, month.monthIndex, entries),
    [entries, month],
  );
  const visibleDays = useMemo(() => getVisibleCalendarDays(days), [days]);
  const monthChatEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.type === "chat" &&
          entry.date.startsWith(`${month.year}-${String(month.monthIndex + 1).padStart(2, "0")}`),
      ),
    [entries, month],
  );

  useEffect(() => {
    setSelectedDate((current) => {
      if (current && monthChatEntries.some((entry) => entry.date === current)) return current;
      return monthChatEntries.at(-1)?.date ?? null;
    });
  }, [monthChatEntries]);

  const selectedEntry = entries.find(
    (entry) => entry.type === "chat" && entry.date === selectedDate,
  );

  function moveMonth(amount: number) {
    setMonth((current) => shiftCalendarMonth(current, amount));
    setSelectedDate(null);
  }

  return (
    <main className="min-h-dvh bg-[#F7F4EC] text-[#383D37]">
      <div className="mx-auto min-h-dvh w-full max-w-3xl px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-3 md:px-8 md:pt-6">
        <header className="grid min-h-[52px] grid-cols-[64px_1fr_80px] items-center">
          <Link
            href="/kid"
            className="flex min-h-11 items-center text-[15px] text-[#5E655C]"
            aria-label="아이 대화로 돌아가기"
          >
            ←
          </Link>
          <p className="font-friendly text-center text-[17px]">Elly</p>
          <Link
            href="/kid"
            className="font-friendly flex min-h-11 items-center justify-end text-[14px] text-[#4F6F59]"
          >
            이야기하기
          </Link>
        </header>

        <div className="mt-5 md:mt-8">
          <h1 className="font-friendly text-[24px] leading-8 tracking-[-0.02em]">내 기록 달력</h1>
          <p className="mt-2 text-[15px] leading-6 text-[#5E655C]">
            파란 점은 Elly와 이야기를 마친 날이에요.
          </p>
        </div>

        <div className="mt-6 grid items-start gap-4 md:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.8fr)] md:gap-5">
          <section
            className="rounded-[24px] bg-white p-4 md:p-5"
            aria-label="월별 기록 달력"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            <div className="grid grid-cols-[44px_1fr_44px] items-center">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="min-h-11 rounded-2xl text-[22px] text-[#5E655C] hover:bg-[#F1F2EC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F6F59]"
                aria-label="이전 달"
              >
                ‹
              </button>
              <h2 className="font-friendly text-center text-[18px] tabular-nums">
                {month.year}년 {month.monthIndex + 1}월
              </h2>
              <button
                type="button"
                onClick={() => moveMonth(1)}
                className="min-h-11 rounded-2xl text-[22px] text-[#5E655C] hover:bg-[#F1F2EC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F6F59]"
                aria-label="다음 달"
              >
                ›
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 text-center text-[12px] text-[#5E655C]" aria-hidden="true">
              {WEEKDAYS.map((weekday) => (
                <span className="py-2" key={weekday}>{weekday}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1">
              {visibleDays.map((day, index) =>
                day.date ? (
                  <button
                    type="button"
                    key={day.date}
                    onClick={() => setSelectedDate(day.date)}
                    className={`relative mx-auto flex min-h-11 w-11 items-start justify-center rounded-2xl pt-1.5 text-[14px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4F6F59] ${
                      selectedDate === day.date
                        ? "bg-[#4F6F59] text-white"
                        : "text-[#383D37] hover:bg-[#F1F2EC]"
                    }`}
                    aria-label={`${month.monthIndex + 1}월 ${day.dayNumber}일${day.hasChat ? ", 대화 기록 있음" : ", 대화 기록 없음"}`}
                    aria-pressed={selectedDate === day.date}
                  >
                    {day.dayNumber}
                    {day.hasChat ? (
                      <span
                        className={`absolute bottom-1.5 h-1.5 w-1.5 rounded-full ${
                          selectedDate === day.date ? "bg-white" : "bg-[#3F70B7]"
                        }`}
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                ) : (
                  <span aria-hidden="true" className="min-h-11" key={`blank-${index}`} />
                ),
              )}
            </div>
          </section>

          <section className="min-h-[250px] rounded-[24px] bg-[#EEF1E9] p-5" aria-live="polite">
            {loading ? (
              <>
                <h2 className="font-friendly text-[18px]">기록을 불러오는 중</h2>
                <div className="mt-5 grid gap-3" aria-hidden="true">
                  <span className="h-5 w-full rounded-full bg-[#DDE1D8]" />
                  <span className="h-5 w-5/6 rounded-full bg-[#DDE1D8]" />
                  <span className="h-5 w-4/6 rounded-full bg-[#DDE1D8]" />
                </div>
              </>
            ) : error ? (
              <>
                <h2 className="font-friendly text-[18px]">기록을 열지 못했어요</h2>
                <p className="mt-3 text-[14px] leading-6 text-[#5E655C]">{error}</p>
                <button
                  type="button"
                  onClick={() => setLoadVersion((version) => version + 1)}
                  className="font-friendly mt-5 min-h-11 w-full rounded-2xl bg-white px-4 text-[15px] text-[#383D37]"
                >
                  다시 불러오기
                </button>
              </>
            ) : selectedEntry?.diary?.length ? (
              <>
                <h2 className="font-friendly text-[18px]">{formatDiaryDate(selectedEntry.date)}</h2>
                <ol className="mt-4 grid gap-3">
                  {selectedEntry.diary.map((line, index) => (
                    <li className="flex gap-3 text-[15px] leading-6" key={`${selectedEntry.id}-${index}`}>
                      <span className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-[#3F70B7]" aria-hidden="true" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <>
                <h2 className="font-friendly text-[18px]">
                  {selectedDate ? formatDiaryDate(selectedDate) : "아직 기록이 없어요"}
                </h2>
                <p className="mt-3 text-[15px] leading-6 text-[#5E655C]">
                  이야기를 마치면 오늘의 3줄 기록과 파란 점이 생겨요.
                </p>
                <Link
                  href="/kid"
                  className="font-friendly mt-5 flex min-h-11 items-center justify-center rounded-2xl bg-[#4F6F59] px-4 text-[15px] text-white"
                >
                  Elly와 이야기하기
                </Link>
              </>
            )}
            {!loading && !error && family ? (
              <div className="mt-6 bg-white px-4 py-3">
                <p className="text-[12px] text-[#5E655C]">이번 달 {family.kidName}의 기록</p>
                <p className="font-friendly mt-1 text-[24px] tabular-nums text-[#383D37]">
                  {monthChatEntries.length}일
                </p>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
