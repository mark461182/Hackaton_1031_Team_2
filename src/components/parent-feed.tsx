import { getParentFeedHeading, type ParentFeedEntry } from "../app/parent/feed-model";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

export { ParentBottomNav } from "./ui/BottomNav";

type ParentFeedProps = {
  familyName: string;
  kidName: string;
  entries: ParentFeedEntry[];
};

type FeedCardProps = {
  entry: ParentFeedEntry;
  kidName: string;
};

const cardBase = "min-w-0 overflow-hidden p-5 [overflow-wrap:anywhere]";

function FeedCard({ entry, kidName }: FeedCardProps) {
  if (entry.kind === "alert") {
    return (
      <Card tone="danger" className={cardBase} data-ui="P-card-alert">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-friendly text-[16px] text-danger-ink">마음 살펴보기</h3>
          <time className="shrink-0 text-[12px] text-danger-meta" dateTime={entry.createdAt}>
            {entry.timeLabel}
          </time>
        </div>
        <blockquote className="font-friendly mt-5 rounded-2xl bg-surface px-4 py-3 text-[17px] leading-7 text-ink">
          “{entry.data.quote}”
        </blockquote>
        <div className="mt-5 space-y-4 text-[15px] leading-6">
          <div>
            <p className="font-semibold text-danger-label">살펴볼 상황</p>
            <p className="mt-1 text-danger-body">{entry.data.situation}</p>
          </div>
          <div className="rounded-2xl bg-danger-wash px-4 py-3">
            <p className="font-semibold text-danger-label">이렇게 말을 건네 보세요</p>
            <p className="mt-1 text-danger-body">{entry.data.guide}</p>
          </div>
        </div>
      </Card>
    );
  }

  if (entry.kind === "reply") {
    return (
      <Card className={cardBase} data-ui="P-card-reply">
        <div className="flex items-start justify-between gap-4">
          <h3 className="font-friendly text-[16px] text-sage-title">질문 답장이 왔어요</h3>
          <time className="shrink-0 text-[12px] text-ink-soft" dateTime={entry.createdAt}>
            {entry.timeLabel}
          </time>
        </div>
        <div className="mt-5 rounded-2xl bg-sage-wash px-4 py-3">
          <p className="text-[13px] font-semibold text-ink-label">맡긴 질문</p>
          <p className="mt-1 text-[15px] leading-6 text-ink">{entry.question}</p>
        </div>
        <div className="mt-5">
          <p className="text-[13px] font-semibold text-ink-label">{kidName}의 답</p>
          <blockquote className="mt-2 text-[18px] font-semibold leading-7 text-ink-quote">
            “{entry.data.answer}”
          </blockquote>
        </div>
        <div className="mt-5 space-y-3 rounded-2xl bg-ivory px-4 py-3 text-[14px] leading-6">
          <p>
            <span className="font-semibold text-ink-label-strong">한눈에 보기</span>
            <span className="mt-1 block text-ink-nav">{entry.data.summary}</span>
          </p>
          <p>
            <span className="font-semibold text-ink-label-strong">오늘 건넬 말</span>
            <span className="mt-1 block text-ink-nav">{entry.data.note}</span>
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card tone="cream" className={cardBase} data-ui="P-card-story">
      <div className="flex items-start justify-between gap-4">
        <h3 className="font-friendly text-[16px] text-ink-story-title">함께 나눈 이야기</h3>
        <time className="shrink-0 text-[12px] text-ink-story-time" dateTime={entry.createdAt}>
          {entry.timeLabel}
        </time>
      </div>
      <p className="mt-4 text-[16px] leading-7 text-ink-story">{entry.data.summary}</p>
    </Card>
  );
}

export function ParentFeed({ familyName, kidName, entries }: ParentFeedProps) {
  return (
    <>
      <header className="px-5 pb-6 pt-8">
        <p className="text-[14px] text-ink-muted">{familyName}</p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <h1 className="font-friendly max-w-[15rem] text-[28px] leading-[1.25] tracking-[-0.02em] text-ink-strong">
            {getParentFeedHeading(entries.length)}
          </h1>
          <p className="shrink-0 text-[15px] text-ink-soft">
            <span className="text-[24px] font-normal tabular-nums text-sage-title">{entries.length}</span>개
          </p>
        </div>
        <Button
          className="mt-6 w-full px-5 py-3 text-[16px] outline-none transition-colors hover:bg-sage-deep-hover focus-visible:ring-4 focus-visible:ring-focus-soft"
          data-ui="P-ask"
          href="/parent/ask"
          size="md"
        >
          아이에게 질문 맡기기
        </Button>
      </header>

      <section aria-labelledby="parent-feed-title" className="px-5 pb-8">
        <h2 id="parent-feed-title" className="font-friendly mb-4 text-[18px] text-ink">
          오늘의 소식
        </h2>
        {entries.length === 0 ? (
          <div className="rounded-card bg-sage-light px-5 py-8 text-center">
            <p className="font-friendly text-[17px] text-ink-sage-title">아직 도착한 소식이 없어요</p>
            <p className="mt-2 text-[14px] leading-6 text-ink-sage-body">
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
      <div className="h-4 w-20 rounded bg-skeleton-feed" />
      <div className="mt-3 h-9 w-52 rounded bg-skeleton-feed-title" />
      <div className="mt-7 h-12 w-full rounded-2xl bg-sage-light" />
      <div className="mt-10 h-5 w-24 rounded bg-skeleton-feed" />
      <div className="mt-4 h-52 w-full rounded-card bg-panel" />
    </div>
  );
}

export function ParentFeedError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center" role="alert">
      <h1 className="font-friendly text-[24px] text-ink-strong">소식을 불러오지 못했어요</h1>
      <p className="mt-3 max-w-xs text-[15px] leading-6 text-ink-soft">
        잠시 뒤 다시 확인해 주세요. 저장된 이야기는 사라지지 않아요.
      </p>
      <Button
        className="mt-6 px-6 py-3 text-[16px] outline-none hover:bg-sage-deep-hover focus-visible:ring-4 focus-visible:ring-focus-soft"
        data-ui="P-retry"
        onClick={onRetry}
        size="md"
      >
        다시 불러오기
      </Button>
    </div>
  );
}
