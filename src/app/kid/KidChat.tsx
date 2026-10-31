"use client";

// 아이 ↔ 코끼리 대화 한 바퀴: 꾹 누르고 말하기 → (받아쓴 글자는 보여 주지 않고 바로) /api/kid/chat → 하율 목소리 + 선택지
// 받아쓰기가 조금 틀려도 LLM이 문맥으로 알아듣는다 (docs/10 견고성 실험), 틀린 글자를 아이에게 보이면 오히려 헷갈림
// 글자 입력은 항상 대체 수단. 저장은 store.ts(B)가 생기면 onTurn에서 한다 (API는 저장하지 않음, docs/09 1장)

import { useEffect, useRef, useState } from "react";
import {
  FIXED_LINES,
  createPushToTalk,
  isSttSupported,
  pickTranscript,
  speak,
  speakFiller,
  stopSpeaking,
  unlockTts,
  type PushToTalk,
} from "@/lib/voice";
import type { ChatTurn, KidChatRequest, KidChatResponse, KidDoneRequest, KidDoneResponse, PendingQuestion } from "@/lib/types";
import { Kokkiri, type KokkiriState } from "./Kokkiri";

const GREETING = FIXED_LINES.find((l) => l.file === "greet")!.text;

type Props = {
  familyId?: string;
  kidName?: string;
  /** 대기 중인 부모 질문 (store.ts가 생기면 거기서 읽어 넘긴다) */
  pendingQuestion?: PendingQuestion | null;
  /** 한 턴이 끝날 때마다: 아이 말 + API 응답 → store.ts로 저장 (B) */
  onTurn?: (kidText: string, res: KidChatResponse) => void;
};

export default function KidChat({ familyId = "demo", kidName, pendingQuestion = null, onTurn }: Props) {
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<KokkiriState>("idle");
  const [history, setHistory] = useState<ChatTurn[]>([]);
  // 일기에서 위험·"말하지 마" 내용을 빼려면 아이 말마다 분류를 같이 넘겨야 한다
  const kidMeta = useRef<KidDoneRequest["messages"]>([]);
  const [choices, setChoices] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);
  const [diary, setDiary] = useState<string[] | null>(null);
  const [mock, setMock] = useState(false);
  const [error, setError] = useState("");
  const ptt = useRef<PushToTalk | null>(null);
  const kidTurns = useRef(0); // 대기 질문을 기다린 아이 말 횟수
  const [stt, setStt] = useState(false); // 음성 인식 지원 여부 (브라우저에서만 확인)
  useEffect(() => setStt(isSttSupported()), []);

  async function say(text: string, previousText?: string) {
    setState("speaking");
    await speak(text, { cloud: { previousText } });
    setState("idle");
  }

  async function start() {
    unlockTts(); // iPhone: 첫 터치에서 소리 풀기
    setStarted(true);
    setHistory([{ from: "kokkiri", text: GREETING }]);
    await say(GREETING);
  }

  async function send(text: string) {
    const kidText = text.trim();
    if (!kidText || busy) return;
    setBusy(true);
    setError("");
    setTyped("");
    setChoices([]);
    stopSpeaking();
    const nextHistory: ChatTurn[] = [...history, { from: "kid", text: kidText }];
    setHistory(nextHistory);
    setState("thinking");

    const body: KidChatRequest = {
      familyId,
      kidName,
      kidText,
      history: history.slice(-10),
      pendingQuestion: pendingQuestion ? { ...pendingQuestion, kidTurnsWaiting: kidTurns.current } : null,
    };
    kidTurns.current += 1;
    // 답을 기다리는 동안 짧은 맞장구 (미리 만든 파일, 크레딧 0)
    const filler = speakFiller();
    try {
      const r = await fetch("/api/kid/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`${r.status}`);
      const res = (await r.json()) as KidChatResponse;
      await filler;
      setMock(Boolean(res.mock));
      kidMeta.current.push({ from: "kid", text: kidText, category: res.category, keepFromParent: res.keepFromParent });
      setHistory([...nextHistory, { from: "kokkiri", text: res.reply }]);
      onTurn?.(kidText, res);
      setBusy(false);
      await say(res.reply, kidText);
      setChoices(res.choices ?? []);
      if (res.endConversation) setEnded(true);
    } catch {
      await filler;
      setError("코끼리가 잠깐 못 들었어. 다시 말해 줄래?");
      setState("idle");
      setBusy(false);
    }
  }

  function talkStart() {
    if (busy) return;
    stopSpeaking();
    setError("");
    ptt.current = createPushToTalk();
    ptt.current.start();
    setState("listening");
  }

  async function talkEnd() {
    if (!ptt.current) return;
    const alts = await ptt.current.stop();
    ptt.current = null;
    setState("idle");
    const text = pickTranscript(alts, choices);
    if (text) await send(text);
    else setError("잘 못 들었어. 다시 말해 줄래?");
  }

  async function finish() {
    setBusy(true);
    try {
      const r = await fetch("/api/kid/done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyId, kidName, messages: kidMeta.current } satisfies KidDoneRequest),
      });
      const res = (await r.json()) as KidDoneResponse;
      setDiary(res.diary);
      await say(FIXED_LINES.find((l) => l.file === "bye")!.text);
    } finally {
      setBusy(false);
      setEnded(true);
    }
  }

  if (!started) {
    return (
      <div className="flex flex-col items-center gap-6 pt-10">
        <Kokkiri state="idle" />
        <button onClick={start} className="rounded-3xl bg-pink-300 px-8 py-5 text-xl font-bold text-white shadow">
          코끼리랑 이야기하기
        </button>
      </div>
    );
  }

  const lastKokkiri = [...history].reverse().find((h) => h.from === "kokkiri")?.text ?? "";

  return (
    <div className="flex min-h-[90vh] flex-col gap-4">
      <Kokkiri state={state} />

      <p className="min-h-16 rounded-3xl bg-violet-50 px-5 py-4 text-center text-lg leading-relaxed">{lastKokkiri}</p>

      {diary && (
        <div className="rounded-2xl bg-amber-50 p-4 text-sm">
          <p className="mb-1 font-semibold">오늘의 일기</p>
          {diary.map((d, i) => (
            <p key={i}>{d}</p>
          ))}
        </div>
      )}

      {error && <p className="text-center text-sm text-amber-700">{error}</p>}

      {!ended && (
          <>
            {choices.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {choices.map((c) => (
                  <button key={c} disabled={busy} onClick={() => send(c)} className="rounded-full border-2 border-violet-200 px-4 py-2 disabled:opacity-40">
                    {c}
                  </button>
                ))}
              </div>
            )}
            {stt && (
              <button
                disabled={busy}
                onPointerDown={talkStart}
                onPointerUp={talkEnd}
                onPointerLeave={() => state === "listening" && talkEnd()}
                className={`select-none rounded-3xl py-6 text-xl font-bold text-white shadow disabled:opacity-40 ${
                  state === "listening" ? "bg-pink-500" : "bg-pink-300"
                }`}
              >
                {state === "listening" ? "듣고 있어… 다 말하면 손 떼기" : "꾹 누르고 말하기"}
              </button>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(typed);
              }}
              className="flex gap-2"
            >
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={stt ? "글자로 써도 돼" : "코끼리한테 하고 싶은 말"}
                className="flex-1 rounded-full border px-4 py-3"
              />
              <button disabled={busy || !typed.trim()} className="rounded-full bg-violet-300 px-5 font-semibold text-white disabled:opacity-40">
                보내기
              </button>
            </form>
          </>
      )}

      {!diary && history.length > 2 && (
        <button disabled={busy} onClick={finish} className="mt-auto text-sm text-gray-500 underline disabled:opacity-40">
          오늘 대화 마치기
        </button>
      )}
      {mock && <p className="text-center text-xs text-gray-400">연습 모드 (가짜 응답)</p>}
    </div>
  );
}
