// STT 결과 보정. 브라우저 음성 인식은 단어 힌트를 받지 않으므로(SpeechGrammarList 무시됨)
// 후보 여러 개를 받아 대화 맥락으로 다시 고르고, 선택지와 비슷하면 그 선택지로 맞춘다.

import type { SttAlternative } from "./stt";

/** 초등 저학년 대화에 자주 나오는 말 — 후보 순위를 매길 때 가산점 */
export const KID_CONTEXT_WORDS = [
  "학교", "친구", "짝꿍", "선생님", "담임", "급식", "쉬는 시간", "엄마", "아빠", "형", "누나", "언니", "오빠", "동생",
  "학원", "숙제", "놀이터", "때려", "때렸어", "놀려", "놀렸어", "싫어", "속상해", "무서워", "좋아", "재밌었어",
  "모르겠어", "말하기 싫어", "괜찮아", "필통", "지우개", "게임", "유튜브",
];

const strip = (s: string) => s.replace(/[\s.,!?~]/g, "");

/** 글자 단위 편집 거리 */
export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** 글자 오류율(CER). 0 = 완벽, 띄어쓰기·문장부호는 무시 */
export function cer(reference: string, hypothesis: string): number {
  const r = strip(reference);
  return r.length === 0 ? 0 : editDistance(r, strip(hypothesis)) / r.length;
}

/** 맥락 단어가 많이 들어간 후보를 위로. 엔진 순위·신뢰도도 같이 반영 */
export function rerank(alts: SttAlternative[], contextWords: string[] = KID_CONTEXT_WORDS): SttAlternative[] {
  const words = contextWords.map(strip).filter(Boolean);
  const score = (a: SttAlternative, rank: number) => {
    const t = strip(a.transcript);
    const hits = words.filter((w) => t.includes(w)).length;
    return hits * 1.0 + (a.confidence || 0) * 0.5 - rank * 0.3;
  };
  return alts
    .map((a, rank) => ({ a, s: score(a, rank) }))
    .sort((x, y) => y.s - x.s)
    .map((x) => x.a);
}

/** 화면에 띄운 선택지와 충분히 비슷하면 그 선택지로 맞춘다 ("어제부텨" → "어제부터") */
export function snapToChoice(text: string, choices: string[], maxCer = 0.34): string | null {
  let best: { c: string; d: number } | null = null;
  for (const c of choices) {
    const d = cer(c, text);
    if (d <= maxCer && (!best || d < best.d)) best = { c, d };
  }
  return best?.c ?? null;
}

/** 후보 목록 → 최종 문장. 선택지 맞추기가 되면 그것을, 아니면 맥락 순위 1위를 */
export function pickTranscript(alts: SttAlternative[], choices: string[] = [], contextWords?: string[]): string {
  for (const a of alts) {
    const snapped = snapToChoice(a.transcript, choices);
    if (snapped) return snapped;
  }
  return rerank(alts, contextWords)[0]?.transcript ?? "";
}
