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
  getKidVoiceSendIntent,
  getKidVoiceViewPresentation,
  parseKidChatResponse,
  type FinishConversationNotice,
  type KidScreenState,
} from "./chat-model";
import {
  buildKidDoneRequest,
  createChatDiaryEntry,
  parseKidDoneResponse,
  selectDiaryMessages,
} from "./diary-model";
import { KokkiriStage } from "@/components/kokkiri/KokkiriStage";
import { KokkiriLipSync } from "@/components/kokkiri/kokkiri-lipsync";
import type { KokkiriPlayer } from "@/components/kokkiri/kokkiri-player";
import { LinkGate } from "@/components/link-gate";
import { activeFamilyLink, kidLinkUrl } from "@/lib/family-link";
import { Button } from "@/components/ui/Button";
import { TopBar } from "@/components/ui/TopBar";
import { getVisitorId, store } from "@/lib/store";
import type { ApiError, Family, Message } from "@/lib/types";
import {
  FIXED_LINES,
  KID_CONTEXT_WORDS,
  createPushToTalk,
  externalOpenUrl,
  getSpeechLevel,
  inAppBrowser,
  isSttSupported,
  pickTranscript,
  speak,
  speakFiller,
  stopSpeaking,
  unlockTts,
  type PushToTalk,
} from "@/lib/voice";

const GREETING = FIXED_LINES.find((line) => line.file === "greet");
const SHARE_YES = FIXED_LINES.find((line) => line.file === "share-yes")?.text ?? "좋아, 고마워!";
const SHARE_NO = FIXED_LINES.find((line) => line.file === "share-no")?.text ?? "알겠어. 말하고 싶을 때 말해 줘.";
const END_WORD = "끝"; // [대화 마치기]가 보내는 말. 말풍선으로는 보여 주지 않는다
const newId = () => globalThis.crypto.randomUUID();
const now = () => new Date().toISOString();

export default function KidPage() {
  return (
    <LinkGate role="kid">
      <KidChatScreen />
    </LinkGate>
  );
}

function KidChatScreen() {
  const [family, setFamily] = useState<Family | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [choices, setChoices] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [screenState, setScreenState] = useState<KidScreenState>("loading");
  const [sttSupported, setSttSupported] = useState(false);
  const [error, setError] = useState("");
  const [pendingShareId, setPendingShareId] = useState<string | null>(null);
  const [finishNotice, setFinishNotice] = useState<FinishConversationNotice | null>(null);
  const [conversationFinished, setConversationFinished] = useState(false);
  const [diaryStatus, setDiaryStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [diaryRetry, setDiaryRetry] = useState<{ finishedAt: string; conversationId: string } | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [inApp, setInApp] = useState<string | null>(null);
  const [panelHeight, setPanelHeight] = useState(240);
  const pushToTalk = useRef<PushToTalk | null>(null);
  const activePointerId = useRef<number | null>(null);
  const actionGate = useRef(createActionGate());
  const speechRun = useRef(0);
  const questionDone = useRef(false); // 이번 대화에서 부모 질문을 이미 끝냈는지
  const kk = useRef<KokkiriPlayer | null>(null);
  const lip = useRef<KokkiriLipSync | null>(null); // 입 그리기 (도하 09_lipsync). 안 되는 브라우저에선 스스로 꺼져 원래 말하기 영상
  const panelRef = useRef<HTMLDivElement | null>(null);

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
        setInApp(inAppBrowser());
        setScreenState("ready");
        unsubscribe = store.subscribe(() => void refresh());
      } catch {
        if (active) {
          setError("대화를 불러오지 못했어. 새로고침해 줘.");
          setScreenState("ready");
        }
      }
    }

    void load();
    return () => {
      active = false;
      unsubscribe();
      stopSpeaking();
      lip.current?.destroy();
      lip.current = null;
    };
  }, []);

  // 코끼리는 아래 버튼판 바로 위에 선다 (버튼판 높이가 바뀌면 발 닿는 높이도 따라간다)
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setPanelHeight(Math.round(panel.getBoundingClientRect().height)));
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  // 화면 상태 → 코끼리 상태. 말하기는 소리 알림(onChunkStart 등)이 움직인다
  useEffect(() => {
    const player = kk.current;
    if (!player) return;
    if (screenState === "listening") player.setState("listening");
    else if (screenState === "thinking" || screenState === "loading") player.setState("thinking");
    else if (screenState === "ready") {
      if (player.state === "speaking") player.speakEnd();
      else player.setState("idle");
    }
  }, [screenState]);

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
        speak(text, {
          // 립싱크가 있으면 입을 소리 크기에 맞춰 그리고(kk.speak는 쓰지 않음), 없으면 말하기 영상
          onChunkStart: (seconds) => (lip.current ? lip.current.start() : kk.current?.speak(seconds)),
          onBrowserStart: () => (lip.current ? lip.current.start({ level: false }) : kk.current?.speakStart()),
          onBrowserEnd: () => (lip.current ? lip.current.end() : kk.current?.speakEnd()),
        }).finally(() => lip.current?.end()),
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
    kk.current?.unlock();
    setError("");
    setFinishNotice(null);
    setConversationFinished(false);
    setDiaryStatus("idle");
    setDiaryRetry(null);
    try {
      if (nameDraft.trim()) setFamily(await store.setKidName(family.id, nameDraft));
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
      setError("대화를 시작하지 못했어. 다시 눌러 줘.");
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
      const savedMessages = selectDiaryMessages(
        await store.getMessages(family.id),
        finishedAt,
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

  async function sendMessage(text: string, confirmed: boolean, allowWhileListening = false, viaChoice = false) {
    const clean = text.trim();
    if (
      !family ||
      !clean ||
      (screenState === "listening" && !allowWhileListening) ||
      !actionGate.current.tryEnter()
    ) return;

    unlockTts();
    interruptSpeech();
    setError("");
    setScreenState("thinking");
    let replyToSpeak: string | undefined;

    try {
      const history = await store.getMessages(family.id);
      // 부모 질문은 대화 한 번(이 화면을 연 동안)에 하나만: 답했거나 닫힌 뒤에는 더 꺼내지 않는다
      const pendingQuestion = questionDone.current ? undefined : await store.getPendingQuestion(family.id);
      const kidMessage: Message = {
        id: newId(),
        familyId: family.id,
        from: "kid",
        text: clean,
        createdAt: now(),
        confirmed,
        ...(viaChoice ? { viaChoice: true } : {}),
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
        skippedQuestionId: result.skippedQuestionId,
        changedAt: createdAt,
      });
      if (result.answeredQuestionId || result.skippedQuestionId) questionDone.current = true;

      if (result.endConversation) {
        const finishResult = await store.finishConversation(family.id, createdAt);
        const notice = getFinishConversationNotice(finishResult);
        setFamily((current) => current ? { ...current, coins: notice.coins } : current);
        setFinishNotice(notice);
        setConversationFinished(true);
        await saveConversationDiary(createdAt, records.kidMessage.id);
      }

      const nextComposer = getKidComposerAfterSend(
        { draft, heardText: "", interim: "", choices },
        { type: "succeeded", choices: result.choices },
      );
      setDraft(nextComposer.draft);
      setChoices(nextComposer.choices);
      setPendingShareId(records.share?.id ?? null);
      replyToSpeak = result.reply;
    } catch {
      stopSpeaking();
      setMessages(await store.getMessages(family.id));
      const retainedComposer = getKidComposerAfterSend(
        { draft, heardText: "", interim: "", choices },
        { type: "failed" },
      );
      setDraft(retainedComposer.draft || clean);
      setChoices(retainedComposer.choices);
      setError("잠깐 연결이 안 됐어. 쓴 말은 그대로 뒀어. 다시 보내 줘.");
      setScreenState("ready");
    } finally {
      actionGate.current.leave();
    }

    if (replyToSpeak) void playSpeech(replyToSpeak);
  }

  async function choose(choice: string) {
    kk.current?.unlock();
    if (pendingShareId && (choice === "좋아" || choice === "싫어")) {
      if (!family || !actionGate.current.tryEnter()) return;
      try {
        await store.resolveShare(family.id, pendingShareId, choice === "좋아" ? "accepted" : "declined");
        setPendingShareId(null);
        setChoices([]);
        // 고른 뒤에도 Elly가 한마디 한다 (부모에게 간다는 말은 하지 않는다)
        const answer = choice === "좋아" ? SHARE_YES : SHARE_NO;
        await store.saveMessage({ id: newId(), familyId: family.id, from: "kokkiri", text: answer, createdAt: now() });
        void playSpeech(answer);
      } catch {
        setError("고른 걸 저장하지 못했어. 다시 눌러 줘.");
      } finally {
        actionGate.current.leave();
      }
      return;
    }
    await sendMessage(choice, false, false, true);
  }

  function startTalk(event: ReactPointerEvent<HTMLButtonElement>) {
    if (busy || !sttSupported || pushToTalk.current) return;
    unlockTts();
    kk.current?.unlock();
    interruptSpeech();
    setError("");
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
      activePointerId.current = event.pointerId;
      const ptt = createPushToTalk();
      pushToTalk.current = ptt;
      ptt.start();
      setScreenState("listening");
    } catch {
      setError("이 브라우저에서는 마이크를 쓸 수 없어. 글자로 써 줘.");
      setScreenState("ready");
    }
  }

  async function endTalk(event?: ReactPointerEvent<HTMLButtonElement>) {
    if (event && activePointerId.current !== null && event.pointerId !== activePointerId.current) return;
    const ptt = pushToTalk.current;
    if (!ptt) return;
    pushToTalk.current = null;
    activePointerId.current = null;
    let sent = false;
    try {
      if (event?.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      const alternatives = await ptt.stop();
      const intent = getKidVoiceSendIntent(
        pickTranscript(alternatives, choices, KID_CONTEXT_WORDS),
      );
      if (!intent) {
        setError("잘 안 들렸어. 다시 말하거나 글자로 써 줘.");
        return;
      }
      sent = true;
      await sendMessage(intent.text, intent.confirmed, true);
    } catch {
      setError("말을 글자로 바꾸지 못했어. 다시 말하거나 글자로 써 줘.");
    } finally {
      if (!sent) setScreenState("ready");
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    kk.current?.unlock();
    void sendMessage(draft, false);
  }

  const stage = getKidStagePresentation(screenState, started, nameDraft.trim() || family?.kidName);
  const voiceView = getKidVoiceViewPresentation(screenState, sttSupported, "");
  const voiceControl = voiceView.control;
  const recentMessages = messages.filter((message) => message.text.trim() !== END_WORD).slice(-2);
  // 외부 브라우저는 저장 공간이 따로라서 열쇠를 다시 붙여 넘긴다 (안 붙이면 링크 안내 화면으로 초기화된다)
  const link = inApp && typeof window !== "undefined" ? activeFamilyLink() : null;
  const openUrl =
    inApp && typeof window !== "undefined"
      ? externalOpenUrl(link?.role === "kid" ? kidLinkUrl(window.location.origin, link.key) : window.location.href)
      : null;

  return (
    <main className="min-h-dvh bg-kid-sky text-kid-ink">
      <KokkiriStage
        onReady={(player) => {
          kk.current = player;
          lip.current?.destroy();
          lip.current = new KokkiriLipSync(player, { base: "/kokkiri/", dataSet: "real", getLevel: getSpeechLevel });
        }}
        className="mx-auto h-dvh w-full max-w-md"
        style={{ "--kk-ground": `${panelHeight + 4}px`, "--kk-size": "76%" } as React.CSSProperties}
      >
        <TopBar
          columns="wide"
          className="px-4 pt-[env(safe-area-inset-top)]"
          left={
            <Link
              href="/"
              className="flex min-h-11 items-center"
              aria-label="첫 화면으로 돌아가기"
              data-ui="K-back"
            >
              <span className="rounded-full bg-surface/85 px-3 py-1 text-[15px]">←</span>
            </Link>
          }
          title={<h1 className="font-friendly text-center text-[18px] text-kid-ink">Elly</h1>}
          right={
            <Link
              href="/kid/coins"
              className="flex min-h-11 items-center justify-end"
              aria-label={`내 코인 ${family?.coins ?? 0}개, 기프티콘 고르기`}
              data-ui="K-coins"
            >
              <span className="rounded-full bg-surface/85 px-3 py-1 text-[13px] tabular-nums">코인 {family?.coins ?? 0} ›</span>
            </Link>
          }
        />

        {inApp ? (
          <div className="mx-4 mt-1 rounded-card bg-surface/90 px-4 py-3 text-[14px] leading-5" role="note">
            <p>{inApp} 안에서는 마이크가 안 될 수 있어. 글자로 쓰거나 크롬·사파리로 열어 줘.</p>
            {openUrl ? (
              <a href={openUrl} className="font-friendly mt-2 inline-block rounded-full bg-kid-accent px-4 py-2 text-on-sage" data-ui="K-open-browser">
                브라우저로 열기
              </a>
            ) : (
              <p className="mt-1 text-[12px] text-ink-muted">오른쪽 위 메뉴 → &lsquo;Safari로 열기&rsquo;</p>
            )}
          </div>
        ) : null}

        <section className="flex flex-col gap-2 px-4 pt-2" aria-live="polite">
          {recentMessages.map((message) => (
            <p
              className={`font-friendly max-w-[86%] rounded-card px-4 py-3 text-[16px] leading-6 shadow-sm ${
                message.from === "kid"
                  ? "ml-auto rounded-br-md bg-kid-bubble-me"
                  : "rounded-bl-md bg-surface/95"
              }`}
              key={`${message.familyId}:${message.id}`}
            >
              {message.text}
            </p>
          ))}
        </section>

        <div
          ref={panelRef}
          className="mt-auto rounded-t-[28px] bg-surface/85 px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] backdrop-blur-md"
        >
          <p className="font-friendly mb-2 text-center text-[16px]" role="status">
            {screenState === "loading" ? "대화를 불러오고 있어" : conversationFinished ? "오늘 이야기 고마워!" : stage.status}
          </p>

          {error ? (
            <p className="mb-2 rounded-2xl bg-danger-bg px-4 py-3 text-[14px] leading-5 text-danger-ink" role="alert">
              {error}
            </p>
          ) : null}

          {!started && screenState !== "loading" ? (
            <div className="grid gap-2">
              <label className="sr-only" htmlFor="kid-name">
                내 이름
              </label>
              <input
                id="kid-name"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                maxLength={12}
                autoComplete="off"
                placeholder={family?.kidName ? `이름 (지금은 ${family.kidName})` : "이름"}
                data-ui="K-name"
                className="font-friendly min-h-12 min-w-0 rounded-full border border-line-input bg-surface px-5 text-center text-[16px] text-kid-ink"
              />
              <Button
                variant="kid"
                size="xl"
                onClick={() => void startConversation()}
                disabled={!family || busy}
                className="w-full px-5 text-[18px] transition-transform active:scale-[0.99] disabled:opacity-60"
                data-ui="K-start"
              >
                이야기 시작
              </Button>
              <p className="text-center text-[13px] text-ink-muted">누르면 Elly가 먼저 소리로 인사해.</p>
            </div>
          ) : null}

          {started ? (
            <div className="grid gap-2">
              {finishNotice ? (
                <div
                  className={`rounded-card px-4 py-3 ${finishNotice.tone === "success" ? "bg-kid-bubble-me" : "bg-surface"}`}
                  role="status"
                >
                  <p className="font-friendly text-[16px] leading-6">{finishNotice.text}</p>
                  <p className="mt-1 text-[13px] tabular-nums text-ink-muted">지금 {finishNotice.coins}코인</p>
                  {diaryStatus === "saving" ? (
                    <p className="mt-2 text-[14px] text-ink-muted">오늘 기록을 만들고 있어.</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {diaryStatus === "saved" ? (
                      <Button
                        href="/kid/calendar"
                        variant="kid-soft"
                        size="xs"
                        className="border border-line-input px-4 text-[15px]"
                        data-ui="K-records"
                      >
                        내 기록 보기
                      </Button>
                    ) : null}
                    <Button
                      href="/kid/coins"
                      variant="kid-soft"
                      size="xs"
                      className="border border-line-input px-4 text-[15px]"
                      data-ui="K-shop"
                    >
                      기프티콘 고르기
                    </Button>
                  </div>
                  {diaryStatus === "error" && diaryRetry ? (
                    <div className="mt-2 rounded-2xl bg-danger-bg p-3">
                      <p className="text-[14px] leading-5 text-danger-ink">오늘 기록만 저장하지 못했어. 다시 눌러 줘.</p>
                      <button
                        type="button"
                        onClick={() => void saveConversationDiary(diaryRetry.finishedAt, diaryRetry.conversationId)}
                        className="font-friendly mt-2 min-h-11 w-full rounded-full bg-surface px-3 text-[14px] text-kid-ink"
                        data-ui="K-retry"
                      >
                        기록 다시 저장
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {choices.length > 0 && !conversationFinished ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {choices.map((choice, index) => (
                    <Button
                      key={choice}
                      variant="kid-soft"
                      size="xs"
                      onClick={() => void choose(choice)}
                      disabled={busy}
                      className="border border-line-input px-4 text-[15px] disabled:opacity-50"
                      data-ui={
                        pendingShareId && choice === "좋아"
                          ? "K-share-yes"
                          : pendingShareId && choice === "싫어"
                            ? "K-share-no"
                            : `K-choice-${index + 1}`
                      }
                    >
                      {choice}
                    </Button>
                  ))}
                </div>
              ) : null}

              {!conversationFinished ? (
                <>
                  <Button
                    variant={screenState === "listening" ? "kid-listening" : "kid"}
                    size="xl"
                    disabled={voiceControl.disabled}
                    onPointerDown={startTalk}
                    onPointerUp={(event) => void endTalk(event)}
                    onPointerCancel={(event) => void endTalk(event)}
                    onLostPointerCapture={(event) => void endTalk(event)}
                    onContextMenu={(event) => event.preventDefault()}
                    className="w-full touch-none select-none px-5 text-[17px] transition-transform [-webkit-touch-callout:none] active:scale-[0.99] disabled:opacity-60"
                    data-ui="K-talk"
                  >
                    {voiceControl.label}
                  </Button>
                  <form onSubmit={submit} className="grid grid-cols-[1fr_auto] gap-2">
                    <label className="sr-only" htmlFor="kid-message">
                      Elly에게 할 말
                    </label>
                    <input
                      id="kid-message"
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      disabled={busy}
                      maxLength={1000}
                      placeholder="글자로 말하기"
                      data-ui="K-text"
                      className="min-h-11 min-w-0 rounded-full border border-line-input bg-surface px-4 text-[15px] text-kid-ink disabled:opacity-50"
                    />
                    <Button
                      type="submit"
                      variant="kid-soft"
                      size="xs"
                      disabled={!draft.trim() || busy || screenState === "listening"}
                      className="border border-line-input px-4 text-[15px] disabled:opacity-50"
                      data-ui="K-send"
                    >
                      보내기
                    </Button>
                  </form>
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={busy || screenState === "listening"}
                    onClick={() => void sendMessage(END_WORD, false)}
                    className="w-full text-[14px] text-kid-ink disabled:opacity-50"
                    data-ui="K-end"
                  >
                    대화 마치기
                  </Button>
                </>
              ) : (
                <Button
                  variant="kid"
                  size="md"
                  onClick={() => {
                    setConversationFinished(false);
                    setFinishNotice(null);
                  }}
                  className="w-full px-4 text-[16px]"
                  data-ui="K-more"
                >
                  이야기 더 하기
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </KokkiriStage>
    </main>
  );
}
