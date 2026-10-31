"use client";

import { useState } from "react";

import { DEMO_PANELS, getVisibleDemoPanels, type DemoPanelId } from "./demo-model";
import { Button } from "@/components/ui/Button";
import { getVisitorId, store } from "@/lib/store";

export default function DemoPage() {
  const [frameVersion, setFrameVersion] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [activePanel, setActivePanel] = useState<DemoPanelId>("parent");

  async function resetDemo() {
    if (resetting) return;
    setResetting(true);
    setError("");
    try {
      await store.resetDemoFamily(getVisitorId());
      setFrameVersion((version) => version + 1);
    } catch {
      setError("예시 가족을 다시 시작하지 못했어요. 새로고침해 주세요.");
    } finally {
      setResetting(false);
    }
  }

  const visibleMobileIds = new Set(
    getVisibleDemoPanels("mobile", activePanel).map((panel) => panel.id),
  );
  const desktopPanels = getVisibleDemoPanels("desktop", activePanel);

  return (
    <main className="min-h-dvh bg-ivory px-4 py-5 text-ink sm:px-6 lg:px-8 lg:py-9">
      <header className="mx-auto mb-6 flex w-full max-w-[940px] flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button
            href="/"
            variant="text"
            size="xs"
            className="inline-flex items-center text-[14px]"
            data-ui="D-back"
          >
            ← 첫 화면
          </Button>
          <h1 className="font-friendly mt-2 text-[30px] tracking-[-0.02em] sm:text-[34px]">같은 가족의 두 화면</h1>
          <p className="mt-3 max-w-xl text-[16px] leading-7 text-ink-muted">
            부모와 아이 화면은 같은 준우네 이야기를 바로 함께 보여 줍니다.
          </p>
        </div>
        <Button
          size="md"
          onClick={() => void resetDemo()}
          disabled={resetting}
          className="shrink-0 px-6 text-[16px] transition-transform active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
          data-ui="D-reset"
        >
          {resetting ? "다시 만드는 중…" : "처음부터 다시"}
        </Button>
      </header>

      {error && (
        <p role="alert" className="mx-auto mb-4 w-full max-w-[940px] rounded-2xl bg-danger-bg px-5 py-3 text-[14px] text-danger-ink">
          {error}
        </p>
      )}

      <div className="mx-auto mb-5 grid w-full max-w-[390px] grid-cols-2 rounded-2xl bg-surface p-1 lg:hidden" aria-label="데모 화면 선택">
        {DEMO_PANELS.map((panel) => (
          <button
            className={`font-friendly min-h-11 rounded-xl text-[15px] ${activePanel === panel.id ? "bg-sage-light text-sage-ink" : "text-ink-muted"}`}
            key={panel.id}
            onClick={() => setActivePanel(panel.id)}
            data-ui={`D-tab-${panel.id}`}
            type="button"
          >
            {panel.id === "parent" ? "부모" : "아이"}
          </button>
        ))}
      </div>

      <section aria-label="부모와 아이 데모 화면" className="mx-auto grid w-full max-w-[940px] gap-8 lg:grid-cols-2 lg:gap-6">
        {desktopPanels.map((panel) => (
          <article key={panel.id} className={`mx-auto w-full min-w-0 max-w-[440px] ${visibleMobileIds.has(panel.id) ? "block" : "hidden lg:block"}`}>
            <h2 className="font-friendly mb-3 px-2 text-[18px]">{panel.title}</h2>
            <div className="rounded-[32px] bg-frame p-px">
              <iframe
                key={`${panel.id}-${frameVersion}`}
                src={panel.src}
                title={`${panel.title} 미리보기`}
                className="h-[720px] w-full rounded-[31px] bg-ivory sm:h-[780px] lg:h-[844px]"
              />
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
