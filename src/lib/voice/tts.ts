// 글자 → 말 (브라우저 speechSynthesis). 클라우드 TTS로 바꿀 때는 speak()만 갈아끼우면 된다.

export type TtsOptions = { voiceURI?: string; rate?: number; pitch?: number };

export const DEFAULT_TTS: Required<Omit<TtsOptions, "voiceURI">> = { rate: 0.95, pitch: 1.1 };

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

/** iPhone은 사용자가 누른 순간에 한 번 말해야 그 뒤로 소리가 난다 — 첫 버튼 onClick에서 호출 */
export function unlockTts(): void {
  if (!isTtsSupported()) return;
  const u = new SpeechSynthesisUtterance(" ");
  u.volume = 0;
  speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (isTtsSupported()) speechSynthesis.cancel();
}

/** 정리 → 문장 단위로 순서대로 읽기. 다 읽으면 끝난다 */
export async function speak(text: string, opts: TtsOptions = {}): Promise<void> {
  if (!isTtsSupported()) return;
  stopSpeaking();
  const voices = await getKoreanVoices();
  const voice = voices.find((v) => v.voiceURI === opts.voiceURI) ?? pickBestVoice(voices);
  for (const sentence of splitSentences(normalizeForSpeech(text))) {
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
