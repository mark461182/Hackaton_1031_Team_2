"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { EllyStage } from "@/components/elly-stage";
import { ParentBottomNav } from "@/components/parent-feed";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { getVisitorId, store } from "@/lib/store";
import type { ApiError, Family, Question } from "@/lib/types";

import {
  MAX_PENDING_QUESTIONS,
  createQuestionFromAsk,
  parseParentAskResponse,
  pendingQueueLabel,
  questionStatusLabel,
  saveQuestionIfRoom,
} from "./ask-model";

const newId = () => globalThis.crypto.randomUUID();
const now = () => new Date().toISOString();

export default function ParentAskPage() {
  const [family, setFamily] = useState<Family | null>(null);
  const [pending, setPending] = useState<Question[]>([]);
  const [proposal, setProposal] = useState<Question | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    async function load() {
      try {
        const loadedFamily = await store.getOrCreateDemoFamily(getVisitorId());
        const refreshPending = async () => {
          const loadedPending = await store.getPendingQuestions(loadedFamily.id);
          if (active) setPending(loadedPending);
        };
        await refreshPending();
        if (!active) return;
        setFamily(loadedFamily);
        unsubscribe = store.subscribe(() => void refreshPending());
      } catch {
        if (active) setError("질문을 불러오지 못했어요. 다시 열어 주세요.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function rewriteQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!family || !text || submitting || pending.length >= MAX_PENDING_QUESTIONS) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/parent/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId: family.id, kidName: family.kidName, text }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiError | null;
        throw new Error(body?.error ?? "질문을 다듬지 못했어요");
      }
      const parsed = parseParentAskResponse(await response.json());
      setProposal(createQuestionFromAsk(family.id, parsed, now(), newId));
    } catch {
      setError("잠시 질문을 다듬지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveQuestion() {
    if (!proposal || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await saveQuestionIfRoom(store, proposal);
      setPending(result.pending);
      setProposal(null);
      if (result.status === "saved") setDraft("");
      else setError(`질문은 ${MAX_PENDING_QUESTIONS}개까지 맡길 수 있어요. 하나를 지우고 다시 맡겨 주세요.`);
    } catch {
      setError("질문을 맡기지 못했어요. 다시 눌러 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelQuestion(question: Question) {
    if (!family || submitting) return;
    if (question.askedAt && !window.confirm("Elly가 지금 물어보고 있는 질문이에요. 그래도 지울까요?")) return;
    setError("");
    try {
      await store.cancelQuestion(family.id, question.id, now());
      setPending(await store.getPendingQuestions(family.id));
    } catch {
      setError("질문을 지우지 못했어요. 다시 눌러 주세요.");
    }
  }

  const full = pending.length >= MAX_PENDING_QUESTIONS;

  return (
    <main className="min-h-dvh bg-ivory text-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-x-hidden">
        <TopBar
          className="px-5"
          left={
            <Link className="flex min-h-11 items-center" href="/parent" aria-label="부모 홈으로 돌아가기" data-ui="PA-back">
              ←
            </Link>
          }
          title={<h1 className="font-friendly text-center text-[18px]">질문 맡기기</h1>}
        />

        <section className="flex flex-1 flex-col px-5 pb-6">
          {loading ? (
            <EllyStage asset="think" compact status="질문을 불러오고 있어요" />
          ) : proposal ? (
            <>
              <p className="mt-3 text-[14px] text-sage-deep">말투를 부드럽게 다듬었어요</p>
              <h2 className="font-friendly mt-2 text-[28px] leading-[1.3]">이 질문으로<br />맡길까요?</h2>
              <div className="mt-6 grid gap-3">
                <Card className="p-5" data-ui="PA-card-mine">
                  <p className="text-[13px] text-ink-muted">내 질문</p>
                  <p className="font-friendly mt-2 text-[17px] leading-7">{proposal.original}</p>
                </Card>
                <Card tone="sage" className="p-5" data-ui="PA-card-rewritten">
                  <p className="text-[13px] text-ink-muted">Elly가 물어볼 말</p>
                  <p className="font-friendly mt-2 text-[17px] leading-7">{proposal.rewritten}</p>
                  <p className="mt-4 text-[14px] leading-6 text-ink-muted">{proposal.whyChanged}</p>
                </Card>
              </div>
              {error ? <p className="mt-3 rounded-2xl bg-danger-bg px-4 py-3 text-[14px] text-danger-ink" role="alert">{error}</p> : null}
              <div className="mt-auto grid gap-2 pt-6">
                <Button size="lg" className="px-5 text-[17px] disabled:opacity-50" disabled={submitting} onClick={() => void saveQuestion()} data-ui="PA-confirm">
                  {submitting ? "맡기는 중…" : "이 질문 맡기기"}
                </Button>
                <Button variant="text" size="xs" className="text-[15px]" onClick={() => setProposal(null)} data-ui="PA-edit">
                  다시 고치기
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-[14px] text-sage-deep">Elly가 자연스럽게 물어볼게요</p>
              <h2 className="font-friendly mt-2 text-[28px] leading-[1.3]">아이에게 궁금한 걸<br />적어 주세요</h2>

              {pending.length > 0 ? (
                <section className="mt-6" aria-label="맡긴 질문" data-ui="PA-queue">
                  <p className="font-friendly text-[16px]">{pendingQueueLabel(pending.length)}</p>
                  <ol className="mt-3 grid gap-2">
                    {pending.map((question, index) => (
                      <li key={question.id}>
                        <Card tone={index === 0 ? "sage" : undefined} className="p-4" data-ui="PA-queue-item">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-[13px] text-ink-muted">{questionStatusLabel(question, index)}</p>
                            <button
                              type="button"
                              className="min-h-8 shrink-0 rounded-full px-3 text-[13px] text-ink-muted underline underline-offset-4"
                              onClick={() => void cancelQuestion(question)}
                              aria-label={`'${question.original}' 질문 지우기`}
                              data-ui="PA-queue-delete"
                            >
                              지우기
                            </button>
                          </div>
                          <p className="font-friendly mt-1 text-[16px] leading-6">{question.rewritten}</p>
                          <p className="mt-1 text-[13px] leading-5 text-ink-muted">내 질문: {question.original}</p>
                        </Card>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : (
                <p className="mt-3 text-[15px] leading-6 text-ink-muted">대화 한 번에 질문 하나씩, 맡긴 순서대로 물어봐요.</p>
              )}

              {full ? (
                <>
                  {error ? <p className="mt-3 rounded-2xl bg-danger-bg px-4 py-3 text-[14px] text-danger-ink" role="alert">{error}</p> : null}
                  <p className="mt-6 rounded-2xl bg-surface px-4 py-3 text-[14px] leading-6 text-ink-muted" data-ui="PA-full">
                    질문은 {MAX_PENDING_QUESTIONS}개까지 맡길 수 있어요. 아이가 답하거나 하나를 지우면 더 맡길 수 있어요.
                  </p>
                </>
              ) : (
                <form className="mt-6 flex flex-1 flex-col" onSubmit={rewriteQuestion}>
                  <div className="rounded-card bg-surface p-5">
                    <label className="font-friendly text-[16px]" htmlFor="parent-question">{pending.length > 0 ? "질문 더 맡기기" : "내 질문"}</label>
                    <textarea
                      className="mt-3 h-28 w-full resize-none rounded-2xl border border-line-input bg-ivory p-4 text-[16px] leading-6"
                      id="parent-question"
                      data-ui="PA-input"
                      maxLength={1000}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="예: 요즘 학교에서 누구랑 가장 많이 놀아?"
                      value={draft}
                    />
                    <p className="mt-3 text-[13px] leading-5 text-ink-muted">아이에게 답을 유도하지 않는 짧은 질문으로 다듬어요.</p>
                  </div>
                  {error ? <p className="mt-3 rounded-2xl bg-danger-bg px-4 py-3 text-[14px] text-danger-ink" role="alert">{error}</p> : null}
                  <Button size="lg" className="mt-auto px-5 text-[17px] disabled:bg-disabled-bg disabled:text-disabled-ink" disabled={!draft.trim() || submitting || !family} type="submit" data-ui="PA-submit">
                    {submitting ? "다듬는 중…" : "Elly에게 다듬어 달라고 하기"}
                  </Button>
                </form>
              )}
            </>
          )}
        </section>
        <ParentBottomNav active="ask" />
      </div>
    </main>
  );
}
