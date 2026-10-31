export type KokkiriBackground = "peach" | "golden";

/** 도하 결정(11/1 D6 메모): 낮에는 살구빛 아침, 밤에는 노란 오후 */
export function backgroundForHour(hour: number): KokkiriBackground {
  return hour >= 6 && hour < 18 ? "peach" : "golden";
}
