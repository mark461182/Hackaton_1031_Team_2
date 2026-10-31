// 글자 → 말. 기본은 클라우드(타입캐스트 아동 목소리, /api/tts), 실패하면 브라우저 speechSynthesis로 대체한다.

export type TtsOptions = {
  voiceURI?: string; // 브라우저 목소리
  rate?: number;
  pitch?: number;
  /** 클라우드 목소리. false면 브라우저 목소리만 */
  cloud?: false | { voiceId?: string; previousText?: string };
};

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

export function stopSpeaking(): void {
  try {
    current?.stop();
  } catch {}
  current = null;
  if (isTtsSupported()) speechSynthesis.cancel();
}

/** 클라우드 목소리로 읽기. 실패하면 false (호출한 쪽이 브라우저 목소리로 대체) */
async function speakCloud(text: string, cloud: { voiceId?: string; previousText?: string }): Promise<boolean> {
  const ac = ctx();
  if (!ac) return false;
  const key = `${cloud.voiceId ?? ""}|${text}`;
  try {
    let buf = audioCache.get(key);
    if (!buf) {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: cloud.voiceId, previousText: cloud.previousText }),
      });
      if (!res.ok) return false;
      buf = await ac.decodeAudioData(await res.arrayBuffer());
      audioCache.set(key, buf);
    }
    await ac.resume();
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(ac.destination);
    current = src;
    await new Promise<void>((resolve) => {
      src.onended = () => resolve();
      src.start();
    });
    if (current === src) current = null;
    return true;
  } catch {
    return false;
  }
}

/** 정리 → 클라우드 목소리로 읽기, 안 되면 브라우저 목소리로 문장 단위 읽기. 다 읽으면 끝난다 */
export async function speak(text: string, opts: TtsOptions = {}): Promise<void> {
  stopSpeaking();
  const clean = normalizeForSpeech(text);
  if (!clean) return;
  if (opts.cloud !== false && (await speakCloud(clean, opts.cloud ?? {}))) return;
  if (!isTtsSupported()) return;
  const voices = await getKoreanVoices();
  const voice = voices.find((v) => v.voiceURI === opts.voiceURI) ?? pickBestVoice(voices);
  for (const sentence of splitSentences(clean)) {
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(sentence);
      u.lang = "ko-KR";
      if (voice) u.voice = voice;
      u.rate = opts.rate ?? DEFAULT_TTS.rate;
      u.pitch = opts.pitch ?? DEFAULT_TTS.pitch;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
  }
}
