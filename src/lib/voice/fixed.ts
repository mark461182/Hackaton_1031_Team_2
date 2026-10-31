// 미리 만들어 둔 코끼리 고정 대사 (하율 목소리). 이 문장들은 /api/tts를 부르지 않아 크레딧 0, 지연 0
// 새 문장 추가: 아래 목록에 넣고 `node scripts/gen-fixed-voice.mjs` (그 문장만 크레딧 사용) → public/voice/에 mp3 생성

export const FIXED_LINES = [
  { file: "greet", text: "안녕! 나 Elly야. 오늘 하루는 어땠어?" },
  { file: "bye", text: "오늘 얘기해 줘서 고마워. 또 놀자!" },
  { file: "again", text: "잘 못 들었어. 다시 한 번 말해 줄래?" },
  { file: "slow", text: "괜찮아, 천천히 말해도 돼." },
  { file: "think", text: "잠깐만, 생각 좀 해 볼게." },
  { file: "wow", text: "우와, 진짜?" },
  { file: "isee", text: "그랬구나." },
  { file: "more", text: "응응, 계속 말해 줘." },
  { file: "hmm", text: "음~" },
  { file: "oh", text: "오!" },
  { file: "really", text: "아 그랬어?" },
  { file: "uhhuh", text: "응응." },
  { file: "share-yes", text: "좋아, 고마워!" },
  { file: "share-no", text: "알겠어. 말하고 싶을 때 말해 줘." },
] as const;

/** 답을 기다리는 동안 바로 틀 맞장구. 아이 말이 슬픈 내용이어도 어색하지 않은 중립적인 것만 */
export const FILLER_FILES = ["hmm", "uhhuh", "think"] as const;

const key = (s: string) => s.replace(/[\s.,!?~]/g, "");
const byText = new Map<string, string>(FIXED_LINES.map((l) => [key(l.text), l.file]));

/** 고정 대사면 mp3 경로, 아니면 null */
export function fixedLineUrl(text: string): string | null {
  const file = byText.get(key(text));
  return file ? `/voice/${file}.mp3` : null;
}
