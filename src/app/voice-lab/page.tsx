"use client";

// 음성 실험실 — STT 정확도를 숫자로 재고, 코끼리 목소리 설정을 고른다.
// 아이 화면 담당은 여기서 고른 설정과 src/lib/voice 함수를 가져다 쓰면 된다.

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_TTS,
  KID_CONTEXT_WORDS,
  cer,
  createPushToTalk,
  getKoreanVoices,
  isSttSupported,
  isTtsSupported,
  normalizeForSpeech,
  pickBestVoice,
  pickTranscript,
  speak,
  splitSentences,
  stopSpeaking,
  unlockTts,
  type PushToTalk,
  type SttAlternative,
} from "@/lib/voice";

// 아이가 실제로 할 법한 말 — 소리 내어 읽고 받아쓰기가 얼마나 맞는지 잰다
const TEST_SENTENCES = [
  "짝꿍이 맨날 내 필통 뺏어",
  "오늘 급식에 떡볶이 나왔어",
  "선생님이 무서워서 말 못 했어",
  "친구들이 나만 빼고 놀아",
  "엄마한테는 말하지 마",
  "학원 가기 싫어",
  "어제부터 배가 아파",
  "몰라 그냥 말하기 싫어",
];

const SAMPLE_LINES = [
  "안녕! 나는 코끼리야. 오늘 하루는 어땠어?",
  "많이 속상했겠다... 그 친구가 언제부터 그랬어? 😢",
  "오늘 학교에서 제일 웃겼던 일이랑, 조금 속상했던 일 하나씩 알려줄래? (천천히 말해도 돼)",
];

type Trial = { target: string; raw: string; picked: string; rawCer: number; pickedCer: number };

const STORE_KEY = "kokkiri.voice-lab.tts";

export default function VoiceLab() {
  const [sttOk, setSttOk] = useState<boolean | null>(null);
  const [ttsOk, setTtsOk] = useState<boolean | null>(null);

  // STT
  const [target, setTarget] = useState(TEST_SENTENCES[0]);
  const [choices, setChoices] = useState("어제부터, 꽤 오래됐어, 말하기 싫어");
  const [interim, setInterim] = useState("");
  const [alts, setAlts] = useState<SttAlternative[]>([]);
  const [listening, setListening] = useState(false);
  const [trials, setTrials] = useState<Trial[]>([]);
  const ptt = useRef<PushToTalk | null>(null);

  // TTS
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(DEFAULT_TTS.rate);
  const [pitch, setPitch] = useState(DEFAULT_TTS.pitch);
  const [line, setLine] = useState(SAMPLE_LINES[1]);

  useEffect(() => {
    setSttOk(isSttSupported());
    setTtsOk(isTtsSupported());
    getKoreanVoices().then((vs) => {
      setVoices(vs);
      let saved: { voiceURI?: string; rate?: number; pitch?: number } = {};
      try {
        saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      } catch {}
      setVoiceURI(saved.voiceURI ?? pickBestVoice(vs)?.voiceURI ?? "");
      if (saved.rate) setRate(saved.rate);
      if (saved.pitch) setPitch(saved.pitch);
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ voiceURI, rate, pitch }));
    } catch {}
  }, [voiceURI, rate, pitch]);

  const choiceList = choices.split(",").map((c) => c.trim()).filter(Boolean);

  function startTalk() {
    unlockTts();
    stopSpeaking();
    setAlts([]);
    setInterim("");
    ptt.current = createPushToTalk(setInterim);
    ptt.current.start();
    setListening(true);
  }

  async function endTalk() {
    if (!ptt.current) return;
    setListening(false);
    const result = await ptt.current.stop();
    ptt.current = null;
    setAlts(result);
    if (!result.length) return;
    const raw = result[0].transcript;
    const picked = pickTranscript(result, choiceList, [...KID_CONTEXT_WORDS, ...target.split(" ")]);
    setTrials((t) => [{ target, raw, picked, rawCer: cer(target, raw), pickedCer: cer(target, picked) }, ...t]);
  }

  const avg = (k: "rawCer" | "pickedCer") =>
    trials.length ? trials.reduce((a, t) => a + t[k], 0) / trials.length : 0;
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold">음성 실험실</h1>
        <p className="text-sm text-gray-600">
          음성 인식 {sttOk === null ? "확인 중" : sttOk ? "지원" : "미지원 → 글자 입력으로 대체"} · 음성 출력{" "}
          {ttsOk === null ? "확인 중" : ttsOk ? "지원" : "미지원"} · 녹음 파일은 저장하지 않음
        </p>
      </header>

      <section className="space-y-3 rounded-2xl border p-4">
        <h2 className="text-lg font-semibold">1. 받아쓰기 정확도 (STT)</h2>
        <p className="text-sm text-gray-600">
          문장을 고르고, 버튼을 누른 채로 소리 내어 읽은 뒤 손을 떼세요. 아이 목소리로 해 보면 가장 정확해요.
        </p>
        <select className="w-full rounded border p-2" value={target} onChange={(e) => setTarget(e.target.value)}>
          {TEST_SENTENCES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <label className="block text-sm">
          화면에 띄운 선택지 (쉼표로 구분, 비슷하면 이걸로 맞춤)
          <input className="mt-1 w-full rounded border p-2" value={choices} onChange={(e) => setChoices(e.target.value)} />
        </label>
        <button
          disabled={!sttOk}
          onPointerDown={startTalk}
          onPointerUp={endTalk}
          onPointerLeave={() => listening && endTalk()}
          className={`w-full select-none rounded-2xl py-6 text-lg font-semibold ${
            listening ? "bg-pink-400 text-white" : "bg-pink-200"
          } disabled:opacity-40`}
        >
          {listening ? "듣고 있어요… 손을 떼면 끝" : "꾹 누르고 말하기"}
        </button>
        {interim && <p className="text-gray-700">말하는 중: {interim}</p>}
        {alts.length > 0 && (
          <div className="text-sm">
            <p className="font-medium">엔진이 준 후보</p>
            <ol className="list-decimal pl-5">
              {alts.map((a, i) => (
                <li key={i}>
                  {a.transcript} <span className="text-gray-500">(신뢰도 {a.confidence ? a.confidence.toFixed(2) : "-"})</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {trials.length > 0 && (
          <div className="space-y-2 text-sm">
            <p className="font-medium">
              {trials.length}회 평균 글자 오류율 — 엔진 그대로 {pct(avg("rawCer"))} → 보정 후 {pct(avg("pickedCer"))} (낮을수록 좋음)
            </p>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th>목표</th>
                  <th>엔진 1순위</th>
                  <th>보정 후</th>
                  <th>오류율</th>
                </tr>
              </thead>
              <tbody>
                {trials.map((t, i) => (
                  <tr key={i} className="border-b align-top">
                    <td>{t.target}</td>
                    <td>{t.raw}</td>
                    <td>{t.picked}</td>
                    <td>
                      {pct(t.rawCer)} → {pct(t.pickedCer)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border p-4">
        <h2 className="text-lg font-semibold">2. 코끼리 목소리 (TTS)</h2>
        <label className="block text-sm">
          목소리 (이 기기에 있는 한국어 목소리 {voices.length}개)
          <select className="mt-1 w-full rounded border p-2" value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)}>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} {v.localService ? "(기기)" : "(온라인)"}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          속도 {rate.toFixed(2)}
          <input type="range" min={0.7} max={1.3} step={0.05} value={rate} onChange={(e) => setRate(+e.target.value)} className="w-full" />
        </label>
        <label className="block text-sm">
          높낮이 {pitch.toFixed(2)}
          <input type="range" min={0.7} max={1.5} step={0.05} value={pitch} onChange={(e) => setPitch(+e.target.value)} className="w-full" />
        </label>
        <div className="flex flex-wrap gap-2">
          {SAMPLE_LINES.map((s, i) => (
            <button key={i} onClick={() => setLine(s)} className="rounded-full border px-3 py-1 text-sm">
              예시 {i + 1}
            </button>
          ))}
        </div>
        <textarea className="w-full rounded border p-2" rows={3} value={line} onChange={(e) => setLine(e.target.value)} />
        <div className="rounded bg-gray-50 p-2 text-sm">
          <p className="font-medium">실제로 읽는 문장 (정리 후, 문장 단위)</p>
          <ol className="list-decimal pl-5">
            {splitSentences(normalizeForSpeech(line)).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
        <div className="flex gap-2">
          <button
            disabled={!ttsOk}
            onClick={() => {
              unlockTts();
              speak(line, { voiceURI, rate, pitch });
            }}
            className="flex-1 rounded-2xl bg-violet-200 py-3 font-semibold disabled:opacity-40"
          >
            코끼리 목소리로 듣기
          </button>
          <button onClick={stopSpeaking} className="rounded-2xl border px-4">
            멈춤
          </button>
        </div>
        <p className="text-xs text-gray-500">
          고른 설정 (아이 화면에 그대로 넘기기): {JSON.stringify({ voiceURI, rate, pitch })}
        </p>
      </section>
    </main>
  );
}
