// 말 → 글자 (브라우저 Web Speech API). 녹음 파일은 만들지도 저장하지도 않는다.
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

/** 꾹 누르고 말하기. onInterim으로 말하는 도중 글자를 받는다 */
export function createPushToTalk(onInterim?: (text: string) => void, maxAlternatives = 5): PushToTalk {
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
      rec.continuous = true; // 버튼을 누르고 있는 동안 계속 듣는다
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
      return combine(segments.filter(Boolean));
    },
  };
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
