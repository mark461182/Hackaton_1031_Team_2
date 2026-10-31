// 코인 충전·기프티콘 화면의 숫자 (정적 화면, 실제 결제·발송 없음)
// 예시 값이다. 가격은 도하가 정한다 (05 결정 #14 미정). 여기 한 곳만 바꾸면 두 화면이 같이 바뀐다

export const WON_PER_COIN = 100;
/** 기프티콘 상품값에 붙는 수수료 (우리 수익) */
export const FEE_RATE = 0.1;
/** 대화를 마치면 받는 코인 (store.finishConversation과 같은 값) */
export const COINS_PER_TALK = 10;

export const CHARGE_PACKS = [
  { id: "10k", won: 10_000, coins: 100 },
  { id: "30k", won: 30_000, coins: 300 },
  { id: "50k", won: 50_000, coins: 500 },
] as const;

export type Gift = { id: string; name: string; icon: string; priceWon: number };

export const GIFTS: Gift[] = [
  { id: "icecream", name: "아이스크림", icon: "🍦", priceWon: 1_500 },
  { id: "jelly", name: "젤리 한 봉지", icon: "🍬", priceWon: 2_000 },
  { id: "crayon", name: "색연필 세트", icon: "🖍️", priceWon: 5_000 },
  { id: "kidscafe", name: "키즈카페 1시간", icon: "🎈", priceWon: 10_000 },
];

/** 기프티콘 하나에 드는 코인 = (상품값 + 수수료) ÷ 코인 값, 올림 */
export function giftCoins(gift: Pick<Gift, "priceWon">): number {
  return Math.ceil((gift.priceWon * (1 + FEE_RATE)) / WON_PER_COIN - 1e-9);
}

export function formatWon(won: number): string {
  return `${won.toLocaleString("ko-KR")}원`;
}
