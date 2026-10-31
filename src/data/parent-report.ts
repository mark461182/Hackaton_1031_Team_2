import type { Id, IsoDate, Report } from "../lib/types";

export type ParentReportHighlight = {
  id: string;
  title: string;
  detail: string;
};

export type ParentWeeklyReport = Report & {
  highlights: ParentReportHighlight[];
};

export function createParentWeeklyReport(
  familyId: Id,
  kidName: string,
  week: IsoDate,
): ParentWeeklyReport {
  return {
    id: `example-report-${familyId}-${week}`,
    familyId,
    week,
    summary: `${kidName}는 이번 주에 친구와 함께 해낸 일과 응원받았던 순간을 즐겁게 이야기했어요. 결과보다 같이한 과정이 기억에 남은 한 주였어요.`,
    highlights: [
      {
        id: "building-together",
        title: "함께 완성한 일이 있었어요",
        detail: "친구와 블록으로 큰 성을 완성했고, 다음에는 지붕까지 같이 만들고 싶다고 했어요.",
      },
      {
        id: "friends-cheered",
        title: "친구들의 응원이 힘이 됐어요",
        detail: "이어달리기 전에는 긴장했지만 친구들이 응원해 줘서 힘을 낼 수 있었다고 했어요.",
      },
    ],
    nextQuestions: [
      `${kidName}가 이번 주에 가장 기억에 남았던 순간은 뭐였어?`,
      "친구와 함께 다시 해 보고 싶은 놀이는 뭐야?",
      "다음 주에 새로 해 보고 싶은 일은 뭐야?",
    ],
  };
}
