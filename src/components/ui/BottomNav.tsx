import Link from "next/link";

export type ParentNavId = "home" | "ask" | "record";

/** 부모 아래 메뉴 항목 — 순서·글자·이동할 곳을 여기서 바꾼다 */
const PARENT_NAV_ITEMS: { id: ParentNavId; href: string; label: string; ui: string }[] = [
  { id: "home", href: "/parent", label: "홈", ui: "P-nav-home" },
  { id: "ask", href: "/parent/ask", label: "질문", ui: "P-nav-ask" },
  { id: "record", href: "/parent/calendar", label: "기록", ui: "P-nav-calendar" },
];

const itemClass =
  "flex min-h-11 items-center justify-center rounded-xl px-3 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-sage-deep";
const activeClass = "font-friendly bg-sage-light text-sage-ink";
const idleClass = "text-ink-nav hover:bg-ivory";

/** 부모 화면 아래 메뉴 (홈 · 질문 · 기록) */
export function BottomNav({ active = "home" }: { active?: ParentNavId }) {
  return (
    <nav aria-label="부모 메뉴" className="sticky bottom-0 mt-auto bg-cream px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
      <div className="mx-auto grid max-w-sm grid-cols-3 gap-1">
        {PARENT_NAV_ITEMS.map((item) => (
          <Link
            className={`${itemClass} ${active === item.id ? activeClass : idleClass}`}
            href={item.href}
            aria-current={active === item.id ? "page" : undefined}
            data-ui={item.ui}
            key={item.id}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export { BottomNav as ParentBottomNav };
