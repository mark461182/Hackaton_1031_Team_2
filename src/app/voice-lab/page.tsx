"use client";

// 음성 실험실 — STT 정확도를 숫자로 재고, 코끼리 목소리 설정을 고른다.
// 아이 화면 담당은 여기서 고른 설정과 src/lib/voice 함수를 가져다 쓰면 된다.

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_TTS,
  KID_CONTEXT_WORDS,
  TYPECAST_KID_VOICES,
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

type Trial = { label: string; target: string; raw: string; picked: string; rawCer: number; pickedCer: number };

const STORE_KEY = "kokkiri.voice-lab.tts";
const TRIALS_KEY = "kokkiri.voice-lab.trials"; // 받아쓴 글자·오류율만 (소리는 저장 안 함)

export default function VoiceLab() {
  const [sttOk, setSttOk] = useState<boolean | null>(null);
  const [ttsOk, setTtsOk] = useState<boolean | null>(null);

  // STT
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [preset, setPreset] = useState(TEST_SENTENCES[0]);
  const [custom, setCustom] = useState(""); // 영상 자막 등 정답 문장
  const [label, setLabel] = useState(""); // 구간 메모 (채널명·이름 X)
  const [toggleMode, setToggleMode] = useState(false); // 길게 듣기: 시작/정지 버튼
  const [copied, setCopied] = useState("");
  const target = mode === "custom" ? custom.trim() : preset;
  const [choices, setChoices] = useState("");
  const [interim, setInterim] = useState("");
  const [alts, setAlts] = useState<SttAlternative[]>([]);
  const [listening, setListening] = useState(false);
  const [heardNothing, setHeardNothing] = useState(false); // 인식 결과가 비면 알려 준다 (아무 표시가 없으면 고장인지 모른다)
  const [trials, setTrials] = useState<Trial[]>([]);
  const ptt = useRef<PushToTalk | null>(null);

  // TTS
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(DEFAULT_TTS.rate);
  const [pitch, setPitch] = useState(DEFAULT_TTS.pitch);
  const [line, setLine] = useState(SAMPLE_LINES[1]);
  const [cloudOn, setCloudOn] = useState(true);
  const [kidVoice, setKidVoice] = useState<string>(TYPECAST_KID_VOICES[0].id);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSttOk(isSttSupported());
    setTtsOk(isTtsSupported());
    getKoreanVoices().then((vs) => {
      setVoices(vs);
      let saved: { voiceURI?: string; rate?: number; pitch?: number; kidVoice?: string; cloudOn?: boolean } = {};
      try {
        saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
      } catch {}
      setVoiceURI(saved.voiceURI ?? pickBestVoice(vs)?.voiceURI ?? "");
      if (saved.rate) setRate(saved.rate);
      if (saved.pitch) setPitch(saved.pitch);
      if (saved.kidVoice) setKidVoice(saved.kidVoice);
      if (typeof saved.cloudOn === "boolean") setCloudOn(saved.cloudOn);
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ voiceURI, rate, pitch, kidVoice, cloudOn }));
    } catch {}
  }, [voiceURI, rate, pitch, kidVoice, cloudOn]);

  // 실험 결과는 새로고침해도 남게 (이 브라우저에만)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TRIALS_KEY) || "[]");
      if (Array.isArray(saved)) setTrials(saved);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(TRIALS_KEY, JSON.stringify(trials));
    } catch {}
  }, [trials]);

  const choiceList = choices.split(",").map((c) => c.trim()).filter(Boolean);

  function startTalk() {
    unlockTts();
    stopSpeaking();
    setAlts([]);
    setInterim("");
    setHeardNothing(false);
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
    setHeardNothing(!result.length);
    if (!result.length) return;
    if (!target) return;
    const raw = result[0].transcript;
    // 보정에는 실제 사용 때 아는 것만 쓴다 (초저 대화 단어 + 화면 선택지). 정답 문장 단어를 넣으면 결과가 부풀려진다
    const picked = pickTranscript(result, choiceList, KID_CONTEXT_WORDS);
    setTrials((t) => [
      { label: label.trim() || `#${t.length + 1}`, target, raw, picked, rawCer: cer(target, raw), pickedCer: cer(target, picked) },
      ...t,
    ]);
  }

  const avg = (k: "rawCer" | "pickedCer") =>
    trials.length ? trials.reduce((a, t) => a + t[k], 0) / trials.length : 0;
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  /** 엑셀·시트에 바로 붙여 넣을 수 있게 탭 구분으로 복사 */
  async function copyResults() {
    const head = ["구간", "정답", "엔진 1순위", "보정 후", "엔진 오류율", "보정 후 오류율"].join("\t");
    const rows = [...trials].reverse().map((t) =>
      [t.label, t.target, t.raw, t.picked, t.rawCer.toFixed(3), t.pickedCer.toFixed(3)].join("\t"),
    );
    const summary = `평균\t\t\t\t${avg("rawCer").toFixed(3)}\t${avg("pickedCer").toFixed(3)}`;
    const text = [head, ...rows, summary].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(`${trials.length}개 복사됨`);
    } catch {
      setCopied("복사 실패 — 표를 직접 드래그해 주세요");
    }
    setTimeout(() => setCopied(""), 2500);
  }

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
          정답 문장을 정하고 소리를 들려주면 받아쓰기 오류율을 잽니다. 소리는 저장하지 않고 받아쓴 글자와 숫자만 남겨요.
        </p>
        <details className="rounded bg-gray-50 p-2 text-sm">
          <summary className="cursor-pointer font-medium">아이 영상으로 실험하는 법 (가상 오디오 케이블)</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-gray-700">
            <li>VB-Audio Virtual Cable 설치 → Windows 소리 설정에서 <b>출력 = CABLE Input</b>, <b>입력(마이크) = CABLE Output</b></li>
            <li>다른 탭에서 영상을 열고, 아래 &ldquo;정답 문장&rdquo;에 그 구간 자막을 붙여 넣기 (영상은 내려받지 않는다)</li>
            <li>&ldquo;길게 듣기&rdquo;를 켜고 [시작] → 영상 구간 재생 → 끝나면 [정지]</li>
            <li>구간 메모에는 &ldquo;영상3 0:15&rdquo;처럼만 (채널명·아이 이름 X)</li>
            <li>끝나면 소리 설정을 원래대로 (안 그러면 스피커에서 소리가 안 남)</li>
          </ol>
        </details>
        <div className="flex gap-2 text-sm">
          <button onClick={() => setMode("preset")} className={`rounded-full border px-3 py-1 ${mode === "preset" ? "bg-gray-900 text-white" : ""}`}>
            준비된 문장
          </button>
          <button onClick={() => setMode("custom")} className={`rounded-full border px-3 py-1 ${mode === "custom" ? "bg-gray-900 text-white" : ""}`}>
            정답 직접 입력 (영상 자막)
          </button>
        </div>
        {mode === "preset" ? (
          <select className="w-full rounded border p-2" value={preset} onChange={(e) => setPreset(e.target.value)}>
            {TEST_SENTENCES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        ) : (
          <textarea
            className="w-full rounded border p-2"
            rows={2}
            placeholder="이 구간에서 아이가 실제로 한 말 (자막)"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        )}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="block">
            구간 메모
            <input className="mt-1 w-full rounded border p-2" placeholder="영상3 0:15" value={label} onChange={(e) => setLabel(e.target.value)} />
          </label>
          <label className="block">
            화면 선택지 (쉼표, 없으면 비우기)
            <input className="mt-1 w-full rounded border p-2" value={choices} onChange={(e) => setChoices(e.target.value)} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={toggleMode} onChange={(e) => setToggleMode(e.target.checked)} disabled={listening} />
          길게 듣기 (누르고 있지 않고 [시작]/[정지]로)
        </label>
        {!target && <p className="text-sm text-amber-700">정답 문장을 먼저 넣어 주세요</p>}
        {toggleMode ? (
          <button
            disabled={!sttOk || !target}
            onClick={() => (listening ? endTalk() : startTalk())}
            className={`w-full rounded-2xl py-6 text-lg font-semibold ${listening ? "bg-pink-400 text-white" : "bg-pink-200"} disabled:opacity-40`}
          >
            {listening ? "듣고 있어요… [정지]" : "[시작]"}
          </button>
        ) : (
          <button
            disabled={!sttOk || !target}
            // 아이폰: 꾹 누르면 글자 선택·메뉴가 떠서 손을 떼도 끝나지 않던 것을 막는다 (아이 화면 버튼과 같게)
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              startTalk();
            }}
            onPointerUp={endTalk}
            onPointerCancel={() => listening && endTalk()}
            onContextMenu={(e) => e.preventDefault()}
            style={{ WebkitTouchCallout: "none" }}
            className={`w-full touch-none select-none rounded-2xl py-6 text-lg font-semibold ${
              listening ? "bg-pink-400 text-white" : "bg-pink-200"
            } disabled:opacity-40`}
          >
            {listening ? "듣고 있어요… 손을 떼면 끝" : "꾹 누르고 말하기"}
          </button>
        )}
        {interim && <p className="text-gray-700">말하는 중: {interim}</p>}
        {heardNothing && (
          <p className="text-sm text-amber-700">
            받아쓴 글자가 없어요. 마이크 권한과 받아쓰기(설정 → 일반 → 키보드) 설정을 확인하거나 &ldquo;길게 듣기&rdquo;로 해 보세요.
          </p>
        )}
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
            <div className="flex items-center gap-2">
              <button onClick={copyResults} className="rounded-full border px-3 py-1">
                결과 복사 (엑셀용)
              </button>
              <button
                onClick={() => confirm("결과를 모두 지울까요?") && setTrials([])}
                className="rounded-full border px-3 py-1 text-gray-500"
              >
                지우기
              </button>
              {copied && <span className="text-gray-600">{copied}</span>}
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b">
                  <th>구간</th>
                  <th>정답</th>
                  <th>엔진 1순위</th>
                  <th>보정 후</th>
                  <th>오류율</th>
                </tr>
              </thead>
              <tbody>
                {trials.map((t, i) => (
                  <tr key={i} className="border-b align-top">
                    <td className="whitespace-nowrap pr-2 text-gray-500">{t.label}</td>
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
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={cloudOn} onChange={(e) => setCloudOn(e.target.checked)} />
          아동 목소리 쓰기 (타입캐스트, 실패하면 아래 브라우저 목소리로 자동 대체)
        </label>
        {cloudOn && (
          <label className="block text-sm">
            아동 목소리
            <select className="mt-1 w-full rounded border p-2" value={kidVoice} onChange={(e) => setKidVoice(e.target.value)}>
              {TYPECAST_KID_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <p className="text-xs text-gray-500">아래 브라우저 목소리 설정은 아동 목소리를 끄거나 실패했을 때 쓰여요</p>
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
            onClick={async () => {
              unlockTts();
              setSpeaking(true);
              await speak(line, { voiceURI, rate, pitch, cloud: cloudOn ? { voiceId: kidVoice } : false });
              setSpeaking(false);
            }}
            className="flex-1 rounded-2xl bg-violet-200 py-3 font-semibold disabled:opacity-40"
          >
            {speaking ? "말하는 중…" : "코끼리 목소리로 듣기"}
          </button>
          <button onClick={stopSpeaking} className="rounded-2xl border px-4">
            멈춤
          </button>
        </div>
        <p className="text-xs text-gray-500">
          고른 설정 (아이 화면에 그대로 넘기기):{" "}
          {JSON.stringify({ voiceURI, rate, pitch, cloud: cloudOn ? { voiceId: kidVoice } : false })}
        </p>
      </section>
    </main>
  );
}
