import { EllyStage } from "@/components/elly-stage";
import { FreshDemoButton } from "@/components/fresh-demo-button";
import { Button } from "@/components/ui/Button";

import { HOME_ACTIONS } from "./home-model";

export default function Home() {
  return (
    <main className="min-h-dvh bg-ivory text-ink">
      <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-8">
        <header>
          <p className="font-friendly text-[18px] text-sage-deep">Elly</p>
          <h1 className="font-friendly mt-3 text-[28px] leading-[1.3] tracking-[-0.02em]">
            아이와 부모의 하루를<br />따뜻하게 이어 줘요
          </h1>
          <p className="mt-3 max-w-[32ch] text-[15px] leading-6 text-ink-muted">
            편하게 이야기를 시작하면 Elly가 가족의 대화를 도와줘요.
          </p>
        </header>

        <div className="flex min-h-[330px] flex-1 items-center justify-center py-2">
          <EllyStage asset="greet" priority status="오늘은 누구와 시작할까요?" />
        </div>

        <nav aria-label="Elly 시작 방식" className="grid gap-2.5">
          {HOME_ACTIONS.map((action) =>
            action.id === "demo" ? (
              <FreshDemoButton key={action.id} label={action.label} />
            ) : (
              <Button
                key={action.id}
                href={action.href}
                variant={action.id === "kid" ? "primary" : "secondary"}
                size={action.id === "kid" ? "lg" : "md"}
                className={`px-5 text-[17px] transition-transform active:scale-[0.99] ${
                  action.id === "kid" ? "hover:bg-sage-deep-hover" : "hover:bg-sage-light-hover"
                }`}
                data-ui={action.id === "kid" ? "H-kid" : "H-parent"}
              >
                {action.label}
              </Button>
            ),
          )}
        </nav>
      </section>
    </main>
  );
}
