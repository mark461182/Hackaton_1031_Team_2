"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";

import {
  buildKidChatRequest,
  createActionGate,
  createChatRecords,
  getFinishConversationNotice,
  getKidComposerAfterSend,
  getKidStagePresentation,
  getKidVoiceControlPresentation,
  parseKidChatResponse,
  type FinishConversationNotice,
  type KidScreenState,
} from "./chat-model";
import {
  buildKidDoneRequest,
  createChatDiaryEntry,
  parseKidDoneResponse,
} from "./diary-model";
import { EllyStage } from "@/components/elly-stage";
import { getVisitorId, store } from "@/lib/store";
import type { ApiError, Family, Message } from "@/lib/types";
import {
  FIXED_LINES,
  KID_CONTEXT_WORDS,
  createPushToTalk,
  isSttSupported,
  pickTranscript,
  speak,
  speakFiller,
  stopSpeaking,
  unlockTts,
  type PushToTalk,
} from "@/lib/voice";

const GREETING = FIXED_LINES.find((line) => line.file === "greet");
const newId = () => globalThis.crypto.randomUUID();
const now = () => new Date().toISOString();

export default function KidPage() {
  const [family, setFamily] = useState<Family | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [choices, setChoices] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [interim, setInterim] = useState("");
  const [heardText, setHeardText] = useState("");
  const [screenState, setScreenState] = useState<KidScreenState>("loading");
  const [sttSupported, setSttSupported] = useState(false);
  const [error, setError] = useState("");
  const [pendingShareId, setPendingShareId] = useState<string | null>(null);
  const [finishNotice, setFinishNotice] = useState<FinishConversationNotice | null>(null);
  const [conversationFinished, setConversationFinished] = useState(false);
  const [diaryStatus, setDiaryStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [diaryRetry, setDiaryRetry] = useState<{ finishedAt: string; conversationId: string } | null>(null);
  const pushToTalk = useRef<PushToTalk | null>(null);
  const activePointerId = useRef<number | null>(null);
  const actionGate = useRef(createActionGate());
  const speechRun = useRef(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const busy = screenState === "thinking";
  const started = messages.length > 0;

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    async function load() {
      try {
        const visitorId = getVisitorId();
        const loadedFamily = await store.getOrCreateDemoFamily(visitorId);
        const refresh = async () => {
          const savedMessages = await store.getMessages(loadedFamily.id);
          if (active) setMessages(savedMessages);
        };
        await refresh();
        if (!active) return;
        setFamily(loadedFamily);
        setSttSupported(isSttSupported());
        setScreenState("ready");
        unsubscribe = store.subscribe(() => void refresh());
      } catch {
        if (active) {
          setError("대화를 불러오지 못했어요. 새로고침해 주세요.");
          setScreenState("ready");
        }
      }
    }

    void load();
    return () => {
      active = false;
      unsubscribe();
      stopSpeaking();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, screenState]);

  function interruptSpeech() {
    speechRun.current += 1;
    stopSpeaking();
  }

  async function playSpeech(text: string) {
    const run = speechRun.current + 1;
    speechRun.current = run;
    setScreenState("speaking");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        speak(text),
        new Promise<void>((resolve) => {
          timer = setTimeout(() => {
            stopSpeaking();
            resolve();
          }, 15_000);
        }),
      ]);
    } catch {
      // 소리가 실패해도 저장된 글자 대화는 그대로 사용할 수 있다.
    } finally {
      if (timer) clearTimeout(timer);
      if (speechRun.current === run) setScreenState("ready");
    }
  }

  async function startConversation() {
    if (!family || !GREETING || !actionGate.current.tryEnter()) return;
    unlockTts();
    setError("");
    setFinishNotice(null);
    setConversationFinished(false);
    setDiaryStatus("idle");
    setDiaryRetry(null);
    try {
      const greeting: Message = {
        id: newId(),
        familyId: family.id,
        from: "kokkiri",
        text: GREETING.text,
        createdAt: now(),
      };
      await store.saveMessage(greeting);
      void playSpeech(GREETING.text);
    } catch {
      setError("대화를 시작하지 못했어요. 다시 눌러 주세요.");
      setScreenState("ready");
    } finally {
      actionGate.current.leave();
    }
  }

  async function saveConversationDiary(finishedAt: string, conversationId: string) {
    if (!family) return;
    setDiaryStatus("saving");
    setDiaryRetry({ finishedAt, conversationId });
    try {
      const day = finishedAt.slice(0, 10);
      const savedMessages = (await store.getMessages(family.id)).filter(
        (message) =>
          message.id !== conversationId &&
          message.createdAt.slice(0, 10) === day &&
          message.createdAt <= finishedAt,
      );
      const diaryResponse = await fetch("/api/kid/done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildKidDoneRequest(family, savedMessages)),
      });
      if (!diaryResponse.ok) {
        const body = (await diaryResponse.json().catch(() => null)) as ApiError | null;
        throw new Error(body?.error ?? "일기 요청에 실패했어요");
      }

      const result = parseKidDoneResponse(await diaryResponse.json());
      await store.saveEntry(
        createChatDiaryEntry({
          familyId: family.id,
          conversationId,
          finishedAt,
          diary: result.diary,
          nextId: newId,
        }),
      );
      setDiaryStatus("saved");
      setDiaryRetry(null);
    } catch {
      setDiaryStatus("error");
    }
  }

  async function sendMessage(text: string, confirmed: boolean) {
    const clean = text.trim();
    if (!family || !clean || screenState === "listening" || !actionGate.current.tryEnter()) return;

    unlockTts();
    interruptSpeech();
    setError("");
    setScreenState("thinking");
    let replyToSpeak: string | undefined;

    try {
      const history = await store.getMessages(family.id);
      const pendingQuestion = await store.getPendingQuestion(family.id);
      const kidMessage: Message = {
        id: newId(),
        familyId: family.id,
        from: "kid",
        text: clean,
        createdAt: now(),
        confirmed,
      };
      setMessages([...history, kidMessage]);
      const request = buildKidChatRequest(family, history, pendingQuestion, clean);
      void speakFiller().catch(() => undefined);

      const response = await fetch("/api/kid/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiError | null;
        throw new Error(body?.error ?? "대화 요청에 실패했어요");
      }

      const result = parseKidChatResponse(await response.json());
      const createdAt = now();
      const records = createChatRecords({
        familyId: family.id,
        kidMessage,
        response: result,
        createdAt,
        nextId: newId,
      });

      stopSpeaking();
      await store.commitKidTurn({
        ...records,
        askedQuestionId: result.askedQuestionId,
        answeredQuestionId: result.answeredQuestionId,
        changedAt: createdAt,
      });

      if (result.endConversation) {
        const finishResult = await store.finishConversation(family.id, createdAt);
        const notice = getFinishConversationNotice(finishResult);
        setFamily((current) => current ? { ...current, coins: notice.coins } : current);
        setFinishNotice(notice);
        setConversationFinished(true);
        await saveConversationDiary(createdAt, records.kidMessage.id);
      }

      const nextComposer = getKidComposerAfterSend(
        { draft, heardText, interim, choices },
        { type: "succeeded", choices: result.choices },
      );
      setDraft(nextComposer.draft);
      setHeardText(nextComposer.heardText);
      setInterim(nextComposer.interim);
      setChoices(nextComposer.choices);
      setPendingShareId(records.share?.id ?? null);
      replyToSpeak = result.reply;
    } catch {
      stopSpeaking();
      setMessages(await store.getMessages(family.id));
      const retainedComposer = getKidComposerAfterSend(
        { draft, heardText, interim, choices },
        { type: "failed" },
      );
      setDraft(retainedComposer.draft || clean);
      setHeardText(retainedComposer.heardText);
      setInterim(retainedComposer.interim);
      setChoices(retainedComposer.choices);
      setError("잠시 연결이 안 됐어요. 작성한 말을 그대로 두었어요. 다시 보내 주세요.");
      setScreenState("ready");
    } finally {
      actionGate.current.leave();
    }

    if (replyToSpeak) void playSpeech(replyToSpeak);
  }

  async function choose(choice: string) {
    if (pendingShareId && (choice === "좋아" || choice === "싫어")) {
      if (!family || !actionGate.current.tryEnter()) return;
      try {
        await store.resolveShare(family.id, pendingShareId, choice === "좋아" ? "accepted" : "declined");
        setPendingShareId(null);
        setChoices([]);
      } catch {
        setError("선택을 저장하지 못했어요. 다시 눌러 주세요.");
      } finally {
        actionGate.current.leave();
      }
      return;
    }
    await sendMessage(choice, false);
  }

  function startTalk(event: ReactPointerEvent<HTMLButtonElement>) {
    if (busy || !sttSupported || pushToTalk.current) return;
    unlockTts();
    interruptSpeech();
    setError("");
    setInterim("");
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
      activePointerId.current = event.pointerId;
      const ptt = createPushToTalk(setInterim);
      pushToTalk.current = ptt;
      ptt.start();
      setScreenState("listening");
    } catch {
      setError("이 브라우저에서는 마이크를 쓸 수 없어요. 글자로 입력해 주세요.");
      setScreenState("ready");
    }
  }

  async function endTalk(event?: ReactPointerEvent<HTMLButtonElement>) {
    if (event && activePointerId.current !== null && event.pointerId !== activePointerId.current) return;
    const ptt = pushToTalk.current;
    if (!ptt) return;
    pushToTalk.current = null;
    activePointerId.current = null;
    try {
      if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const alternatives = await ptt.stop();
      const picked = pickTranscript(alternatives, choices, KID_CONTEXT_WORDS).trim();
      if (!picked) {
        setError("잘 들리지 않았어요. 다시 말하거나 글자로 입력해 주세요.");
        return;
      }
      setDraft(picked);
      setHeardText(picked);
    } catch {
      setError("음성을 글자로 바꾸지 못했어요. 다시 말하거나 글자로 입력해 주세요.");
    } finally {
      setInterim("");
      setScreenState("ready");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(draft, heardText.length > 0);
  }

  const stage = getKidStagePresentation(screenState, started);
  const voiceControl = getKidVoiceControlPresentation(screenState, sttSupported);
  const recentMessages = messages.slice(-2);

  return (
    <main className="min-h-dvh bg-[#F7F4EC] text-[#383D37]">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-x-hidden bg-[#F7F4EC]">
        <header className="grid min-h-[52px] grid-cols-[64px_1fr_80px] items-center px-5">
          <Link
            href="/"
            className="flex min-h-11 items-center text-[15px] text-[#5E655C]"
            aria-label="첫 화면으로 돌아가기"
          >
            ←
          </Link>
          <h1 className="font-friendly text-center text-[18px]">Elly</h1>
          <span
            className="flex min-h-11 items-center justify-end text-[13px] tabular-nums text-[#5E655C]"
            aria-label={`보유 코인 ${family?.coins ?? 0}개`}
          >
            코인 {family?.coins ?? 0}
          </span>
        </header>

        <section className="flex min-h-0 flex-1 flex-col px-5 pb-3" aria-live="polite">
          <EllyStage
            asset={stage.asset}
            compact={started || screenState === "loading"}
            priority
            status={stage.status}
          >
            {started && recentMessages.length > 0 ? (
              <div className="mt-3 grid w-full gap-2 text-left">
                {recentMessages.map((message) => (
                  <p
                    className={`font-friendly max-w-[88%] rounded-[20px] px-4 py-3 text-[16px] leading-6 ${
                      message.from === "kid"
                        ? "ml-auto rounded-br-md bg-[#DCE8D8] text-[#383D37]"
                        : "rounded-bl-md bg-white text-[#383D37]"
                    }`}
                    key={`${message.familyId}:${message.id}`}
                  >
                    {message.text}
                  </p>
                ))}
              </div>
            ) : null}
          </EllyStage>

          {screenState === "loading" ? (
            <p className="pb-5 text-center text-[14px] text-[#5E655C]">대화를 불러오고 있어요.</p>
          ) : null}

          {error ? (
            <p className="mb-2 rounded-2xl bg-[#F9E3DF] px-4 py-3 text-[14px] leading-5 text-[#873B32]" role="alert">
              {error}
            </p>
          ) : null}

          {!started && screenState !== "loading" ? (
            <div className="pb-[max(20px,env(safe-area-inset-bottom))]">
              <p className="mx-auto mb-4 max-w-[30ch] text-center text-[15px] leading-6 text-[#5E655C]">
                버튼을 누르면 Elly가 먼저 소리로 인사해요.
              </p>
              <button
                type="button"
                onClick={() => void startConversation()}
                disabled={!family || busy}
                className="font-friendly min-h-[64px] w-full rounded-2xl bg-[#4F6F59] px-5 text-[18px] text-white transition-transform active:scale-[0.99] disabled:bg-[#E8E6DF] disabled:text-[#565B55]"
              >
                이야기 시작
              </button>
            </div>
          ) : null}

          {started ? (
            <div className="mt-auto pb-[max(12px,env(safe-area-inset-bottom))]">
              {finishNotice ? (
                <div
                  className={`mb-2 rounded-[20px] px-4 py-4 ${
                    finishNotice.tone === "success" ? "bg-[#DCE8D8]" : "bg-white"
                  }`}
                  role="status"
                >
                  <p className="font-friendly text-[16px] leading-6">{finishNotice.text}</p>
                  <p className="mt-1 text-[13px] tabular-nums text-[#5E655C]">
                    지금 {finishNotice.coins}코인
                  </p>
                  {diaryStatus === "saving" ? (
                    <p className="mt-3 text-[14px] text-[#5E655C]">오늘 기록을 만들고 있어요.</p>
                  ) : null}
                  {diaryStatus === "saved" ? (
                    <Link
                      href="/kid/calendar"
                      className="font-friendly mt-3 flex min-h-11 items-center justify-center rounded-2xl bg-white px-4 text-[15px] text-[#383D37]"
                    >
                      내 기록 보기
                    </Link>
                  ) : null}
                  {diaryStatus === "error" && diaryRetry ? (
                    <div className="mt-3 rounded-2xl bg-[#F9E3DF] p-3">
                      <p className="text-[14px] leading-5 text-[#873B32]">
                        오늘 기록만 저장하지 못했어요. 다시 눌러 주세요.
                      </p>
                      <button
                        type="button"
                        onClick={() => void saveConversationDiary(diaryRetry.finishedAt, diaryRetry.conversationId)}
                        className="font-friendly mt-2 min-h-11 w-full rounded-xl bg-white px-3 text-[14px] text-[#383D37]"
                      >
                        기록 다시 저장
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {interim && !conversationFinished ? (
                <div className="mb-2 rounded-2xl bg-[#DCE8D8] px-4 py-3 text-[15px] leading-6">
                  <span className="block text-[13px] text-[#383D37]">지금 들리는 말</span>
                  {interim}
                </div>
              ) : null}

              {heardText && !conversationFinished ? (
                <div className="mb-2 rounded-[20px] bg-white p-4">
                  <p className="text-[13px] text-[#5E655C]">이렇게 말한 게 맞아?</p>
                  <p className="font-friendly mt-2 text-[17px] leading-6">“{heardText}”</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      className="font-friendly min-h-11 rounded-2xl bg-[#DCE8D8] px-3 text-[15px]"
                      disabled={busy}
                      onClick={() => {
                        setHeardText("");
                        setDraft("");
                      }}
                      type="button"
                    >
                      다시 말하기
                    </button>
                    <button
                      className="font-friendly min-h-11 rounded-2xl bg-[#4F6F59] px-3 text-[15px] text-white"
                      disabled={busy}
                      onClick={() => void sendMessage(heardText, true)}
                      type="button"
                    >
                      맞아
                    </button>
                  </div>
                </div>
              ) : null}

              {choices.length > 0 && !heardText && !conversationFinished ? (
                <div className="mb-2 grid grid-cols-2 gap-2">
                  {choices.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => void choose(choice)}
                      disabled={busy}
                      className="font-friendly min-h-12 rounded-2xl bg-[#DCE8D8] px-3 text-[15px] text-[#383D37] disabled:opacity-50"
                    >
                      {choice}
                    </button>
                  ))}
                </div>
              ) : null}

              {!heardText && !conversationFinished ? (
                <button
                  type="button"
                  disabled={voiceControl.disabled}
                  onPointerDown={startTalk}
                  onPointerUp={(event) => void endTalk(event)}
                  onPointerCancel={(event) => void endTalk(event)}
                  onLostPointerCapture={(event) => void endTalk(event)}
                  onContextMenu={(event) => event.preventDefault()}
                  className={`font-friendly min-h-[64px] w-full touch-none select-none rounded-2xl px-5 text-[17px] transition-transform active:scale-[0.99] ${
                    screenState === "listening"
                      ? "bg-[#728F7A] text-[#111614]"
                      : "bg-[#4F6F59] text-white"
                  } disabled:bg-[#E8E6DF] disabled:text-[#565B55]`}
                >
                  {voiceControl.label}
                </button>
              ) : null}

              {!conversationFinished ? (
                <>
                  <form onSubmit={submit} className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                    <label className="sr-only" htmlFor="kid-message">
                      Elly에게 할 말
                    </label>
                    <input
                      id="kid-message"
                      value={draft}
                      onChange={(event) => {
                        setDraft(event.target.value);
                        if (heardText) setHeardText(event.target.value);
                      }}
                      disabled={busy}
                      maxLength={1000}
                      placeholder="키보드로 말하기"
                      className="min-h-12 min-w-0 rounded-2xl border border-[#D8D9D1] bg-white px-4 text-[15px] text-[#383D37] disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!draft.trim() || busy || screenState === "listening"}
                      className="font-friendly min-h-12 rounded-2xl bg-[#DCE8D8] px-4 text-[15px] text-[#383D37] disabled:bg-[#E8E6DF] disabled:text-[#777B75]"
                    >
                      보내기
                    </button>
                  </form>
                  <button
                    type="button"
                    disabled={busy || screenState === "listening"}
                    onClick={() => void sendMessage("끝", false)}
                    className="font-friendly mt-2 min-h-11 w-full rounded-2xl text-[14px] text-[#5E655C] disabled:opacity-50"
                  >
                    대화 마치기
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setConversationFinished(false);
                    setFinishNotice(null);
                  }}
                  className="font-friendly min-h-12 w-full rounded-2xl bg-[#DCE8D8] px-4 text-[15px] text-[#383D37]"
                >
                  이야기 더 하기
                </button>
              )}
              <div ref={bottomRef} />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
