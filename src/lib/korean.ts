// 이름 뒤에 붙는 말 (받침에 따라 바뀜): 민준아·준우야, 민준이가·준우가

function hasFinalConsonant(word: string): boolean {
  const code = word.trim().slice(-1).charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}

/** 부르는 말: 민준아, 준우야 */
export function callName(name: string): string {
  return `${name.trim()}${hasFinalConsonant(name) ? "아" : "야"}`;
}

/** 주어로 쓸 때: 민준이가, 준우가 */
export function nameSubject(name: string): string {
  return `${name.trim()}${hasFinalConsonant(name) ? "이가" : "가"}`;
}

/** 방법·바꿀 대상: 받침이 없거나 ㄹ 받침이면 "로" (세트로), 그 밖의 받침은 "으로" (아이스크림으로) */
export function withRo(word: string): string {
  const code = word.trim().slice(-1).charCodeAt(0) - 0xac00;
  const final = code >= 0 && code <= 11171 ? code % 28 : 0;
  return `${word.trim()}${final === 0 || final === 8 ? "로" : "으로"}`;
}
