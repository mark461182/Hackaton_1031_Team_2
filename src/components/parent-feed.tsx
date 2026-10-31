import Link from "next/link";

import { getParentFeedHeading, type ParentFeedEntry } from "../app/parent/feed-model";

type ParentFeedProps = {
  familyName: string;
  kidName: string;
  entries: ParentFeedEntry[];
};

type FeedCardProps = {
  entry: ParentFeedEntry;
  kidName: string;
};

const cardBase =
  "min-w-0 overflow-hidden rounded-[20px] p-5 [overflow-wrap:anywhere]";

function FeedCard({ entry, kidName }: FeedCardProps) {
  if (entry.kind === "alert") {
    return (
      <article className={`${cardBase} bg-[#F9E3DF]`}>
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-friendly text-[16px] text-[#873B32]">마음 살펴보기</h3>
          <time className="shrink-0 text-[12px] text-[#6F5A57]" dateTime={entry.createdAt}>
            {entry.timeLabel}
          </time>
        </div>
        <blockquote className="font-friendly mt-5 rounded-2xl bg-white px-4 py-3 text-[17px] leading-7 text-[#383D37]">
          “{entry.data.quote}”
        </blockquote>
        <div className="mt-5 space-y-4 text-[15px] leading-6">
          <div>
            <p className="font-semibold text-[#5A3A37]">살펴볼 상황</p>
            <p className="mt-1 text-[#514845]">{entry.data.situation}</p>
          </div>
          <div className="rounded-2xl bg-[#F7E7E3] px-4 py-3">
            <p className="font-semibold text-[#5A3A37]">이렇게 말을 건네 보세요</p>
            <p className="mt-1 text-[#514845]">{entry.data.guide}</p>
          </div>
        </div>
      </article>
    );
  }

  if (entry.kind === "reply") {
    return (
      <article className={`${cardBase} bg-white`}>
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-friendly text-[16px] text-[#3F6147]">질문 답장이 왔어요</h3>
          <time className="shrink-0 text-[12px] text-[#667064]" dateTime={entry.createdAt}>
            {entry.timeLabel}
          </time>
        </div>
        <div className="mt-5 rounded-2xl bg-[#EEF3EB] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#5A6958]">맡긴 질문</p>
          <p className="mt-1 text-[15px] leading-6 text-[#383D37]">{entry.question}</p>
        </div>
        <div className="mt-5">
          <p className="text-[13px] font-semibold text-[#5A6958]">{kidName}의 답</p>
          <blockquote className="mt-2 text-[18px] font-semibold leading-7 text-[#2F352F]">
            “{entry.data.answer}”
          </blockquote>
        </div>
        <div className="mt-5 space-y-3 rounded-2xl bg-[#F7F4EC] px-4 py-3 text-[14px] leading-6">
          <p>
            <span className="font-semibold text-[#455343]">한눈에 보기</span>
            <span className="mt-1 block text-[#596257]">{entry.data.summary}</span>
          </p>
          <p>
            <span className="font-semibold text-[#455343]">오늘 건넬 말</span>
            <span className="mt-1 block text-[#596257]">{entry.data.note}</span>
          </p>
        </div>
      </article>
    );
  }

  return (
    <article className={`${cardBase} bg-[#FFFDF8]`}>
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-friendly text-[16px] text-[#5C6259]">함께 나눈 이야기</h3>
        <time className="shrink-0 text-[12px] text-[#70756D]" dateTime={entry.createdAt}>
          {entry.timeLabel}
        </time>
      </div>
      <p className="mt-4 text-[16px] leading-7 text-[#424840]">{entry.data.summary}</p>
    </article>
  );
}

export function ParentFeed({ familyName, kidName, entries }: ParentFeedProps) {
  return (
    <>
      <header className="px-5 pb-6 pt-8">
        <p className="text-[14px] text-[#5E655C]">{familyName}</p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <h1 className="font-friendly max-w-[15rem] text-[28px] leading-[1.25] tracking-[-0.02em] text-[#30362F]">
            {getParentFeedHeading(entries.length)}
          </h1>
          <p className="shrink-0 text-[15px] text-[#667064]">
            <span className="text-[24px] font-normal tabular-nums text-[#3F6147]">{entries.length}</span>개
          </p>
        </div>
        <Link
          className="font-friendly mt-6 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#4F6F59] px-5 py-3 text-[16px] text-white outline-none transition-colors hover:bg-[#435F4B] focus-visible:ring-4 focus-visible:ring-[#AFC6AF]"
          href="/parent/ask"
        >
          아이에게 질문 맡기기
        </Link>
      </header>

      <section aria-labelledby="parent-feed-title" className="px-5 pb-8">
        <h2 id="parent-feed-title" className="font-friendly mb-4 text-[18px] text-[#383D37]">
          오늘의 소식
        </h2>
        {entries.length === 0 ? (
          <div className="rounded-[20px] bg-[#DCE8D8] px-5 py-8 text-center">
            <p className="font-friendly text-[17px] text-[#3F4B3D]">아직 도착한 소식이 없어요</p>
            <p className="mt-2 text-[14px] leading-6 text-[#4F5A4D]">
              아이와 대화를 시작하면 필요한 소식이 여기에 모여요.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry) => (
              <FeedCard entry={entry} kidName={kidName} key={`${entry.kind}-${entry.data.id}`} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export function ParentFeedLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="px-5 pb-8 pt-9">
      <span className="sr-only">부모 소식을 불러오는 중</span>
      <div className="h-4 w-20 rounded bg-[#E0E5DC]" />
      <div className="mt-3 h-9 w-52 rounded bg-[#D7DED3]" />
      <div className="mt-7 h-12 w-full rounded-2xl bg-[#DCE8D8]" />
      <div className="mt-10 h-5 w-24 rounded bg-[#E0E5DC]" />
      <div className="mt-4 h-52 w-full rounded-[20px] bg-[#EEF0EA]" />
    </div>
  );
}

export function ParentFeedError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center" role="alert">
      <h1 className="font-friendly text-[24px] text-[#30362F]">소식을 불러오지 못했어요</h1>
      <p className="mt-3 max-w-xs text-[15px] leading-6 text-[#667064]">
        잠시 뒤 다시 확인해 주세요. 저장된 이야기는 사라지지 않아요.
      </p>
      <button
        className="font-friendly mt-6 min-h-[52px] rounded-2xl bg-[#4F6F59] px-6 py-3 text-[16px] text-white outline-none hover:bg-[#435F4B] focus-visible:ring-4 focus-visible:ring-[#AFC6AF]"
        onClick={onRetry}
        type="button"
      >
        다시 불러오기
      </button>
    </div>
  );
}

export function ParentBottomNav({ active = "home" }: { active?: "home" | "ask" | "record" }) {
  const itemClass = "flex min-h-11 items-center justify-center rounded-xl px-3 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[#4F6F59]";
  return (
    <nav aria-label="부모 메뉴" className="sticky bottom-0 mt-auto bg-[#FFFDF8] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
      <div className="mx-auto grid max-w-sm grid-cols-3 gap-1">
        <Link className={`${itemClass} ${active === "home" ? "font-friendly bg-[#DCE8D8] text-[#35523C]" : "text-[#596257] hover:bg-[#F7F4EC]"}`} href="/parent" aria-current={active === "home" ? "page" : undefined}>
          홈
        </Link>
        <Link className={`${itemClass} ${active === "ask" ? "font-friendly bg-[#DCE8D8] text-[#35523C]" : "text-[#596257] hover:bg-[#F7F4EC]"}`} href="/parent/ask" aria-current={active === "ask" ? "page" : undefined}>
          질문
        </Link>
        <Link className={`${itemClass} ${active === "record" ? "font-friendly bg-[#DCE8D8] text-[#35523C]" : "text-[#596257] hover:bg-[#F7F4EC]"}`} href="/parent/calendar" aria-current={active === "record" ? "page" : undefined}>
          기록
        </Link>
      </div>
    </nav>
  );
}
