"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ParentBottomNav } from "../../../components/parent-feed";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { TopBar } from "../../../components/ui/TopBar";
import { createParentWeeklyReport } from "../../../data/parent-report";
import { getVisitorId, store } from "../../../lib/store";
import type { Family } from "../../../lib/types";

import { formatWeekRange, getWeekRange } from "./report-model";

export default function ParentReportPage() {
  const [anchorDate] = useState(() => new Date());
  const [family, setFamily] = useState<Family | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;

    async function loadFamily() {
      try {
        const loadedFamily = await store.getOrCreateDemoFamily(getVisitorId());
        if (active) {
          setFamily(loadedFamily);
          setStatus("ready");
        }
      } catch {
        if (active) setStatus("error");
      }
    }

    void loadFamily();
    return () => {
      active = false;
    };
  }, []);

  const weekRange = useMemo(() => getWeekRange(anchorDate), [anchorDate]);
  const report = useMemo(
    () => family
      ? createParentWeeklyReport(family.id, family.kidName, weekRange.start)
      : null,
    [family, weekRange.start],
  );
  const period = formatWeekRange(weekRange.start, weekRange.end);

  return (
    <main className="min-h-dvh bg-ivory text-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-x-hidden">
        <TopBar
          className="px-5"
          left={
            <Link
              aria-label="가족 기록으로 돌아가기"
              className="flex min-h-11 items-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sage-deep"
              data-ui="PR-back"
              href="/parent/calendar"
            >
              ←
            </Link>
          }
          title={<h1 className="font-friendly text-center text-[20px]">주간 리포트</h1>}
        />

        <div className="flex-1 px-5 pb-8 pt-3">
          {status === "loading" ? (
            <div aria-busy="true" aria-live="polite">
              <span className="sr-only">주간 리포트를 불러오는 중</span>
              <div className="h-4 w-28 rounded-lg bg-skeleton" />
              <div className="mt-3 h-6 w-44 rounded-lg bg-skeleton" />
              <div className="mt-5 h-52 rounded-card bg-surface" />
              <div className="mt-5 h-40 rounded-card bg-panel" />
            </div>
          ) : null}

          {status === "error" ? (
            <section className="rounded-card bg-surface px-5 py-7" role="alert">
              <h2 className="font-friendly text-[20px]">리포트를 불러오지 못했어요</h2>
              <p className="mt-2 text-[15px] leading-6 text-ink-muted">
                가족 기록으로 돌아갔다가 다시 열어 주세요.
              </p>
              <Button
                className="mt-5 px-5 text-[15px] outline-none focus-visible:ring-4 focus-visible:ring-focus-soft"
                data-ui="PR-calendar"
                href="/parent/calendar"
                size="sm"
              >
                가족 기록으로 돌아가기
              </Button>
            </section>
          ) : null}

          {status === "ready" && family && report ? (
            <>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[13px] text-ink-muted">{family.name}</p>
                  <h2 className="font-friendly mt-1 text-[22px]">{family.kidName}의 이번 주</h2>
                </div>
                <p className="shrink-0 text-right text-[13px] tabular-nums text-ink-muted">{period}</p>
              </div>

              <Card className="mt-5 p-5" data-ui="PR-card-summary">
                <h2 className="font-friendly text-[16px] text-sage-title">이번 주 한눈에</h2>
                <p className="font-friendly mt-4 text-[19px] leading-8 text-ink-strong">
                  {report.summary}
                </p>
                <p className="mt-5 text-[12px] leading-5 text-ink-soft">
                  예시 가족의 이번 주 기록을 바탕으로 만든 리포트예요.
                </p>
              </Card>

              <section aria-labelledby="weekly-highlights-title" className="mt-7">
                <h2 className="font-friendly text-[18px]" id="weekly-highlights-title">
                  기억해 둘 이야기
                </h2>
                <div className="mt-3 overflow-hidden rounded-card bg-sage-mist">
                  {report.highlights.map((highlight, index) => (
                    <article
                      className={`px-5 py-5 ${index > 0 ? "border-t border-line-sage" : ""}`}
                      key={highlight.id}
                    >
                      <h3 className="font-friendly text-[16px] text-sage-title">{highlight.title}</h3>
                      <p className="mt-2 text-[15px] leading-6 text-ink-sage-body">{highlight.detail}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section aria-labelledby="next-questions-title" className="mt-7">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 className="font-friendly text-[18px]" id="next-questions-title">
                      다음 주에 물어볼 말
                    </h2>
                    <p className="mt-1 text-[13px] text-ink-muted">편한 질문 하나만 골라도 좋아요.</p>
                  </div>
                  <span className="shrink-0 text-[13px] tabular-nums text-ink-muted">3개</span>
                </div>
                <div className="mt-3 overflow-hidden rounded-card bg-surface">
                  {report.nextQuestions.map((question, index) => (
                    <p
                      className={`px-5 py-4 text-[15px] leading-6 ${index > 0 ? "border-t border-line-soft" : ""}`}
                      key={question}
                    >
                      “{question}”
                    </p>
                  ))}
                </div>
                <Button
                  className="mt-4 px-5 text-[16px] outline-none transition-colors hover:bg-sage-deep-hover focus-visible:ring-4 focus-visible:ring-focus-soft"
                  data-ui="PR-ask"
                  href="/parent/ask"
                  size="md"
                >
                  아이에게 질문 맡기기
                </Button>
              </section>
            </>
          ) : null}
        </div>

        <ParentBottomNav active="record" />
      </div>
    </main>
  );
}
