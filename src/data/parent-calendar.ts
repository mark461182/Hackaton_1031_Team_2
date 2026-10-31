import type { Entry, Id, IsoDate } from "../lib/types";

const toIsoDate = (date: Date): IsoDate => {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const daysBefore = (anchorDate: Date, amount: number): IsoDate => {
  const date = new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth(),
    anchorDate.getDate() - amount,
    12,
  );
  return toIsoDate(date);
};

export function createParentCalendarEntries(familyId: Id, anchorDate: Date): Entry[] {
  const today = daysBefore(anchorDate, 0);
  const twoDaysAgo = daysBefore(anchorDate, 2);
  const fiveDaysAgo = daysBefore(anchorDate, 5);

  return [
    {
      id: `example-chat-${today}`,
      familyId,
      date: today,
      type: "chat",
      ref: `example-conversation-${today}`,
      diary: [
        "오늘 학교에서 민수와 블록 놀이를 했다.",
        "우리 팀이 큰 성을 완성해서 뿌듯했다.",
        "내일은 지붕까지 같이 만들고 싶다.",
      ],
    },
    {
      id: `example-chat-${twoDaysAgo}`,
      familyId,
      date: twoDaysAgo,
      type: "chat",
      ref: `example-conversation-${twoDaysAgo}`,
      diary: [
        "체육 시간에 이어달리기를 했다.",
        "처음엔 긴장했지만 친구들이 응원해 줬다.",
        "다음에는 더 힘차게 달리고 싶다.",
      ],
    },
    {
      id: `example-photo-${twoDaysAgo}`,
      familyId,
      date: twoDaysAgo,
      type: "photo",
      ref: "example-family-photo",
    },
    {
      id: `example-chat-${fiveDaysAgo}`,
      familyId,
      date: fiveDaysAgo,
      type: "chat",
      ref: `example-conversation-${fiveDaysAgo}`,
      diary: [
        "가족과 공원에서 낙엽을 주웠다.",
        "바스락거리는 소리가 재미있었다.",
        "예쁜 잎은 책갈피로 간직하고 싶다.",
      ],
    },
  ];
}
