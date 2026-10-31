// 말 → 글자 (브라우저 Web Speech API). 녹음 파일은 만들지도 저장하지도 않는다.
// 안드로이드 크롬은 구글, 아이폰 사파리는 애플 받아쓰기 엔진이 쓰인다.

import { isMobile } from "./env";
// 크롬은 소리를 구글 서버에서 처리하고, 파이어폭스는 지원하지 않는다.

export type SttAlternative = { transcript: string; confidence: number };

type RecognitionResultList = {
  length: number;
  [i: number]: { isFinal: boolean; length: number; [j: number]: SttAlternative };
};

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSttSupported(): boolean {
  return getCtor() !== null;
}

export type PushToTalk = {
  /** 버튼을 누를 때 */
  start(): void;
  /** 버튼에서 손을 뗄 때. 후보 목록(첫 번째가 엔진 1순위)을 돌려준다 */
  stop(): Promise<SttAlternative[]>;
};

/**
 * 꾹 누르고 말하기. onInterim으로 말하는 도중 글자를 받는다.
 * 휴대폰은 연속 듣기를 끈다: 안드로이드 크롬은 연속 듣기에서 같은 말이 겹쳐 받아써지는 버그가 있고,
 * 아이폰은 연속 듣기가 불안정하다. 대신 말을 멈추면 그 문장에서 끝난다.
 */
export function createPushToTalk(
  onInterim?: (text: string) => void,
  maxAlternatives = 5,
  continuous = !isMobile(),
): PushToTalk {
  const Ctor = getCtor();
  if (!Ctor) throw new Error("이 브라우저는 음성 인식을 지원하지 않아요");

  let rec: Recognition | null = null;
  // 문장 조각마다 후보가 따로 오므로, 조각별 후보를 모았다가 이어 붙인다
  let segments: SttAlternative[][] = [];
  let finished: Promise<void> = Promise.resolve();

  return {
    start() {
      segments = [];
      rec = new Ctor();
      rec.lang = "ko-KR";
      rec.interimResults = true;
      rec.maxAlternatives = maxAlternatives;
      rec.continuous = continuous; // PC: 버튼을 누르고 있는 동안 계속 듣는다
      finished = new Promise((resolve) => {
        rec!.onend = () => resolve();
        rec!.onerror = () => resolve();
      });
      rec.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) {
            const alts: SttAlternative[] = [];
            for (let j = 0; j < r.length; j++) alts.push({ transcript: r[j].transcript, confidence: r[j].confidence });
            segments[i] = alts;
          } else {
            interim += r[0].transcript;
          }
        }
        const done = segments.map((s) => s?.[0]?.transcript ?? "").join(" ");
        onInterim?.((done + " " + interim).trim());
      };
      rec.start();
    },
    async stop() {
      rec?.stop();
      await finished;
      return combine(dedupeSegments(segments.filter(Boolean)));
    },
  };
}

/**
 * 겹친 조각 걸러 내기 (안드로이드 연속 듣기 버그 안전장치):
 * 같은 조각이 또 오거나, 다음 조각이 앞 조각을 포함해서 다시 오면 앞 것을 버린다.
 * 예: ["짝꿍이", "짝꿍이 때려"] → ["짝꿍이 때려"], ["짝꿍이 때려", "짝꿍이 때려"] → ["짝꿍이 때려"]
 */
export function dedupeSegments(segments: SttAlternative[][]): SttAlternative[][] {
  const norm = (s: SttAlternative[]) => (s[0]?.transcript ?? "").replace(/\s+/g, "");
  const out: SttAlternative[][] = [];
  for (const seg of segments) {
    const prev = out[out.length - 1];
    if (prev && norm(seg).startsWith(norm(prev))) out[out.length - 1] = seg;
    else if (prev && norm(prev).endsWith(norm(seg))) continue;
    else out.push(seg);
  }
  return out;
}

/** 조각별 후보를 문장 후보로 합친다: 1순위끼리 이은 것 + 조각 하나씩만 바꾼 것 */
function combine(segments: SttAlternative[][]): SttAlternative[] {
  if (segments.length === 0) return [];
  const best = segments.map((s) => s[0]);
  const join = (parts: SttAlternative[]) => ({
    transcript: parts.map((p) => p.transcript.trim()).join(" "),
    confidence: parts.reduce((a, p) => a + (p.confidence || 0), 0) / parts.length,
  });
  const out = [join(best)];
  segments.forEach((alts, i) => {
    alts.slice(1).forEach((alt) => {
      const parts = [...best];
      parts[i] = alt;
      out.push(join(parts));
    });
  });
  const seen = new Set<string>();
  return out.filter((a) => (seen.has(a.transcript) ? false : (seen.add(a.transcript), true)));
}
