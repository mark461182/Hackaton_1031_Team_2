// 글자 → 말. 기본은 클라우드(타입캐스트 아동 목소리, /api/tts), 실패하면 브라우저 speechSynthesis로 대체한다.
// 고정 대사(fixed.ts)는 미리 만든 mp3를 틀어 크레딧을 쓰지 않는다.

import { FILLER_FILES, FIXED_LINES, fixedLineUrl } from "./fixed";
import { TTS_MAX_CHARS } from "./voices";

export type TtsOptions = {
  voiceURI?: string; // 브라우저 목소리
  rate?: number;
  pitch?: number;
  /** 클라우드 목소리. false면 브라우저 목소리만 */
  cloud?: false | CloudOptions;
  // 립싱크용 알림: 소리를 받아 오는 시간이 있어서 speak()를 부른 순간이 아니라 실제로 소리가 나는 순간에 온다
  /** 클라우드·고정 대사 한 덩어리가 나기 직전. seconds = 그 덩어리 길이 (덩어리마다 한 번) */
  onChunkStart?: (seconds: number) => void;
  /** 브라우저 목소리 첫 문장이 나기 시작 (길이를 모름) */
  onBrowserStart?: () => void;
  /** 브라우저 목소리 마지막 문장이 끝남 (멈췄을 때 포함) */
  onBrowserEnd?: () => void;
};

export type CloudOptions = { voiceId?: string; previousText?: string };

export const DEFAULT_TTS: Required<Pick<TtsOptions, "rate" | "pitch">> = { rate: 0.95, pitch: 1.1 };

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** 목소리 목록은 늦게 로드되는 브라우저가 많아 이벤트를 기다린다 */
export function getKoreanVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isTtsSupported()) return Promise.resolve([]);
  const pick = () => speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("ko"));
  const now = pick();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(pick());
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

// 자연스러운 순서 (기기에 있는 것 중 앞쪽을 고른다). 방송 목소리는 브라우저에 없으므로 해당 없음
const PREFERRED = [/natural/i, /online/i, /google/i, /yuna|유나/i, /sunhi|선희/i, /heami|혜미/i];

export function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  for (const re of PREFERRED) {
    const v = voices.find((x) => re.test(x.name));
    if (v) return v;
  }
  return voices[0];
}

/** 읽기 전에 문장 정리: 소리로 읽으면 이상한 것들을 없앤다 */
export function normalizeForSpeech(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}|️|‍/gu, "") // 이모지
    .replace(/[ㅋㅎ]{2,}/g, "") // ㅋㅋ ㅎㅎ
    .replace(/[ㅠㅜ]{2,}/g, "") // ㅠㅠ
    .replace(/\([^)]*\)|\[[^\]]*\]/g, "") // 괄호 속 보충 설명
    .replace(/[*_#`>]/g, "") // 마크다운 기호
    .replace(/~+/g, "")
    .replace(/\.{2,}|…/g, ", ") // 말줄임표 → 짧은 쉼
    .replace(/\s+/g, " ")
    .trim();
}

/** 문장 단위로 자른다 (크롬은 긴 문장을 읽다 15초쯤에서 끊기는 버그가 있음) */
export function splitSentences(text: string, maxLen = 60): string[] {
  const out: string[] = [];
  for (const s of text.split(/(?<=[.!?。])\s+/)) {
    if (s.length <= maxLen) {
      out.push(s);
      continue;
    }
    // 너무 긴 문장만 쉼표에서 한 번 더 자른다
    let buf = "";
    for (const part of s.split(/(?<=,)\s*/)) {
      if (buf && (buf + part).length > maxLen) {
        out.push(buf);
        buf = "";
      }
      buf += (buf ? " " : "") + part;
    }
    if (buf) out.push(buf);
  }
  return out.map((s) => s.trim()).filter(Boolean);
}

// 클라우드 오디오는 Web Audio로 재생한다 (iPhone에서 첫 터치 때 한 번 풀어 두면 이후 자동 재생 가능)
let audioCtx: AudioContext | null = null;
let current: AudioBufferSourceNode | null = null;
let analyser: AnalyserNode | null = null; // 지금 나는 소리 크기 (입 모양용, getSpeechLevel)
let levelData: Uint8Array<ArrayBuffer> | null = null;
const audioCache = new Map<string, AudioBuffer>(); // 같은 문장은 다시 받지 않는다 (인사말 등)

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    audioCtx = Ctor ? new Ctor() : null;
  }
  return audioCtx;
}

/** iPhone은 사용자가 누른 순간에 소리를 한 번 풀어야 그 뒤로 소리가 난다 — 첫 버튼 onClick에서 호출 */
export function unlockTts(): void {
  void ctx()?.resume();
  if (!isTtsSupported()) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  speechSynthesis.speak(u);
}

/**
 * 소리 출력만 다시 깨운다 (무음 음성은 재생하지 않아서 녹음과 안 겹친다)
 * 아이폰은 마이크를 쓴 뒤 오디오가 멈춰 있어서, 손가락이 닿거나 떨어지는 순간에 깨워 둬야 답이 소리로 나온다
 */
export function resumeAudio(): void {
  void ctx()?.resume();
}

export function stopSpeaking(): void {
  generation++;
  try {
    current?.stop();
  } catch {}
  current = null;
  if (isTtsSupported()) speechSynthesis.cancel();
}

/** 한 번에 보낼 수 있는 길이로 문장을 묶는다. 문장 중간은 자르지 않고, 정말 긴 문장만 띄어쓰기에서 자른다 */
export function packChunks(text: string, max = TTS_MAX_CHARS): string[] {
  const pieces: string[] = [];
  for (const s of splitSentences(text, max)) {
    let rest = s;
    while (rest.length > max) {
      const cut = rest.lastIndexOf(" ", max);
      const at = cut > 0 ? cut : max;
      pieces.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) pieces.push(rest);
  }
  const chunks: string[] = [];
  for (const p of pieces) {
    const last = chunks[chunks.length - 1];
    if (last !== undefined && last.length + 1 + p.length <= max) chunks[chunks.length - 1] = `${last} ${p}`;
    else chunks.push(p);
  }
  return chunks;
}

let generation = 0; // stopSpeaking()이나 새 speak()가 오면 진행 중인 읽기를 멈추는 표시

/** 고정 대사는 public/voice의 mp3(크레딧 0), 나머지는 /api/tts. 실패하면 null */
async function loadBuffer(text: string, cloud: CloudOptions): Promise<AudioBuffer | null> {
  const ac = ctx();
  if (!ac) return null;
  const fixed = fixedLineUrl(text);
  const key = fixed ?? `${cloud.voiceId ?? ""}|${text}`;
  const hit = audioCache.get(key);
  if (hit) return hit;
  try {
    let res = fixed ? await fetch(fixed) : undefined;
    // 고정 대사 문장을 바꾸고 mp3를 아직 다시 만들지 않았으면 클라우드 목소리로 읽는다
    if (!res?.ok) {
      res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: cloud.voiceId, previousText: cloud.previousText }),
      });
    }
    if (!res.ok) return null;
    const buf = await ac.decodeAudioData(await res.arrayBuffer());
    audioCache.set(key, buf);
    return buf;
  } catch {
    return null;
  }
}

function output(ac: AudioContext): AudioNode {
  if (!analyser) {
    analyser = ac.createAnalyser();
    analyser.fftSize = 512;
    analyser.connect(ac.destination);
    levelData = new Uint8Array(analyser.fftSize);
  }
  return analyser;
}

/** 지금 코끼리 목소리 크기 0~1 (클라우드·고정 대사만, 브라우저 목소리는 0). 입 모양을 바꿀 때 requestAnimationFrame에서 읽는다 */
export function getSpeechLevel(): number {
  if (!analyser || !levelData || !current) return 0;
  analyser.getByteTimeDomainData(levelData);
  let sum = 0;
  for (const v of levelData) sum += ((v - 128) / 128) ** 2;
  return Math.min(1, Math.sqrt(sum / levelData.length) * 4);
}

async function playBuffer(buf: AudioBuffer, onStart?: (seconds: number) => void): Promise<void> {
  const ac = ctx()!;
  await ac.resume();
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.connect(output(ac));
  current = src;
  await new Promise<void>((resolve) => {
    src.onended = () => resolve();
    onStart?.(buf.duration);
    src.start();
  });
  if (current === src) current = null;
}

/** 클라우드 목소리로 덩어리마다 읽는다 (다음 덩어리는 읽는 동안 미리 받아 둠). 읽은 덩어리 수를 돌려준다 */
async function speakCloud(chunks: string[], cloud: CloudOptions, gen: number, onStart?: (seconds: number) => void): Promise<number> {
  let next = loadBuffer(chunks[0], cloud);
  for (let i = 0; i < chunks.length; i++) {
    const buf = await next;
    if (!buf || gen !== generation) return i;
    if (i + 1 < chunks.length) next = loadBuffer(chunks[i + 1], { ...cloud, previousText: chunks[i] });
    await playBuffer(buf, onStart);
    if (gen !== generation) return i + 1;
  }
  return chunks.length;
}

async function speakBrowser(sentences: string[], opts: TtsOptions, gen: number): Promise<void> {
  if (!isTtsSupported()) return;
  const voices = await getKoreanVoices();
  const voice = voices.find((v) => v.voiceURI === opts.voiceURI) ?? pickBestVoice(voices);
  let started = false;
  try {
    for (const sentence of sentences) {
      if (gen !== generation) return;
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(sentence);
        u.lang = "ko-KR";
        if (voice) u.voice = voice;
        u.rate = opts.rate ?? DEFAULT_TTS.rate;
        u.pitch = opts.pitch ?? DEFAULT_TTS.pitch;
        u.onstart = () => {
          if (!started) opts.onBrowserStart?.();
          started = true;
        };
        u.onend = () => resolve();
        u.onerror = () => resolve();
        speechSynthesis.speak(u);
      });
    }
  } finally {
    if (started) opts.onBrowserEnd?.();
  }
}

/** 정리 → 아동 목소리로 끝까지 읽기. 아동 목소리가 안 되는 부분부터는 브라우저 목소리로 이어 읽는다 */
export async function speak(text: string, opts: TtsOptions = {}): Promise<void> {
  stopSpeaking();
  const gen = generation;
  const clean = normalizeForSpeech(text);
  if (!clean) return;
  const chunks = packChunks(clean);
  const done = opts.cloud === false ? 0 : await speakCloud(chunks, opts.cloud ?? {}, gen, opts.onChunkStart);
  if (done >= chunks.length || gen !== generation) return;
  await speakBrowser(chunks.slice(done).flatMap((c) => splitSentences(c)), opts, gen);
}

/** LLM 답을 기다리는 동안 바로 트는 짧은 맞장구 (미리 만든 파일, 크레딧 0) */
export async function speakFiller(opts: TtsOptions = {}): Promise<void> {
  const file = FILLER_FILES[Math.floor(Math.random() * FILLER_FILES.length)];
  const line = FIXED_LINES.find((l) => l.file === file);
  if (line) await speak(line.text, opts);
}
