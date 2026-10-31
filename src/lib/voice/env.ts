// 기기·브라우저 판별 (음성 인식이 기기마다 다르게 동작해서 필요)

const ua = () => (typeof navigator === "undefined" ? "" : navigator.userAgent);

export function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(ua());
}

/** 앱 안에서 링크를 연 인앱 브라우저 이름 (마이크가 막히는 경우가 많다). 아니면 null */
export function inAppBrowser(): string | null {
  const u = ua();
  if (/KAKAOTALK/i.test(u)) return "카카오톡";
  if (/NAVER\(inapp/i.test(u)) return "네이버";
  if (/Instagram/i.test(u)) return "인스타그램";
  if (/FBAN|FBAV/i.test(u)) return "페이스북";
  if (/Line\//i.test(u)) return "라인";
  if (/everytimeApp/i.test(u)) return "에브리타임";
  return null;
}

/**
 * 크롬이 아닌 브라우저 이름 (음성 인식 엔진이 달라서 아이 말을 덜 알아듣는다). 크롬이면 null
 * 아이폰은 어떤 브라우저든 같은 애플 엔진이라 바꿔도 소용없어서 null. 인앱 브라우저는 inAppBrowser()가 따로 안내한다
 */
export function nonChromeBrowser(): string | null {
  const u = ua();
  if (!u || /iPhone|iPad|iPod/i.test(u) || inAppBrowser()) return null;
  if (/SamsungBrowser/i.test(u)) return "삼성 인터넷";
  if (/EdgA?\//i.test(u)) return "엣지";
  if (/Whale/i.test(u)) return "웨일";
  if (/OPR\/|Opera/i.test(u)) return "오페라";
  if (/Firefox/i.test(u)) return "파이어폭스";
  if (/YaBrowser/i.test(u)) return "얀덱스";
  if (typeof navigator !== "undefined" && "brave" in navigator) return "브레이브";
  if (/; wv\)/.test(u)) return "앱 안 브라우저";
  if (/Chrome\//.test(u)) return null;
  return /Safari\//.test(u) ? "사파리" : "이 브라우저";
}

/** 인앱 브라우저에서 기본 브라우저로 여는 주소. 카카오톡·안드로이드만 가능, 그 외는 null (직접 열기 안내) */
export function externalOpenUrl(url: string): string | null {
  const u = ua();
  if (/KAKAOTALK/i.test(u)) return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
  if (/Android/i.test(u)) {
    const noScheme = url.replace(/^https?:\/\//, "");
    // 크롬이 없는 폰이면 같은 주소를 지금 브라우저로 다시 연다
    return `intent://${noScheme}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
  }
  return null;
}
