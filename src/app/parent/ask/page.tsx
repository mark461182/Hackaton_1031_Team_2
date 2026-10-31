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

import { createQuestionFromAsk, parseParentAskResponse, saveQuestionIfNonePending } from "./ask-model";

const newId = () => globalThis.crypto.randomUUID();
const now = () => new Date().toISOString();

export default function ParentAskPage() {
  const [family, setFamily] = useState<Family | null>(null);
  const [pending, setPending] = useState<Question | null>(null);
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
          const loadedPending = await store.getPendingQuestion(loadedFamily.id);
          if (active) setPending(loadedPending ?? null);
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
    if (!family || !text || submitting || pending) return;
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
      const result = await saveQuestionIfNonePending(store, proposal);
      setPending(result.question);
      setProposal(null);
      if (result.status === "already_pending") {
        setError("다른 화면에서 먼저 맡긴 질문을 보여 드려요.");
      }
    } catch {
      setError("질문을 맡기지 못했어요. 다시 눌러 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

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
          ) : pending ? (
            <>
              <p className="mt-3 text-[14px] text-sage-deep">{family?.kidName ?? "아이"}에게 맡긴 질문</p>
              <h2 className="font-friendly mt-2 text-[28px] leading-[1.3]">답장을 기다리고<br />있어요</h2>
              <Card tone="sage" className="mt-6 p-5" data-ui="PA-card-pending">
                <p className="text-[13px] text-ink-muted">Elly가 물어볼 말</p>
                <p className="font-friendly mt-2 text-[18px] leading-7">{pending.rewritten}</p>
                {pending.whyChanged ? <p className="mt-4 text-[14px] leading-6 text-ink-muted">{pending.whyChanged}</p> : null}
              </Card>
              <EllyStage asset="think" compact status="대화 흐름에 맞춰 물어볼게요" />
              <Button variant="surface" size="md" className="text-[16px]" href="/parent" data-ui="PA-home">
                부모 홈으로 돌아가기
              </Button>
            </>
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
              <p className="mt-3 text-[15px] leading-6 text-ink-muted">한 번에 질문 하나를 맡길 수 있어요.</p>
              <form className="mt-6 flex flex-1 flex-col" onSubmit={rewriteQuestion}>
                <div className="rounded-card bg-surface p-5">
                  <label className="font-friendly text-[16px]" htmlFor="parent-question">내 질문</label>
                  <textarea
                    className="mt-3 h-36 w-full resize-none rounded-2xl border border-line-input bg-ivory p-4 text-[16px] leading-6"
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
            </>
          )}
        </section>
        <ParentBottomNav active="ask" />
      </div>
    </main>
  );
}
