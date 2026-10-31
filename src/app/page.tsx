import { EllyStage } from "@/components/elly-stage";
import { FreshDemoButton } from "@/components/fresh-demo-button";
import { Button } from "@/components/ui/Button";

import { HOME_ACTIONS } from "./home-model";

const HOW_IT_WORKS = [
  { title: "궁금한 걸 Elly에게 맡겨요", body: "부모님 질문을 아이가 편하게 답할 말로 다듬어요." },
  { title: "아이에게 Elly 링크를 보내요", body: "아이는 링크를 열면 바로 Elly와 이야기해요." },
  { title: "아이의 답을 카드로 받아요", body: "아이 말과 대화 팁을 전해요. 위험한 신호는 바로 알려요." },
];

export default function Home() {
  return (
    <main className="min-h-dvh bg-ivory text-ink">
      <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-8">
        <header>
          <p className="font-friendly text-[18px] text-sage-deep">Elly</p>
          <h1 className="font-friendly mt-3 text-[28px] leading-[1.3] tracking-[-0.02em]">
            아이가 엄마 아빠한테<br />못 한 말, Elly가 들어 줘요
          </h1>
        </header>

        <div className="flex items-center justify-center py-2">
          <EllyStage asset="greet" priority compact status="저는 아이의 이야기 친구 Elly예요" />
        </div>

        <ol aria-label="Elly 이용 방법" className="mb-5 grid gap-2" data-ui="H-steps">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step.title} className="flex gap-3 rounded-card bg-surface px-4 py-3">
              <span className="font-friendly grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sage-wash text-[14px] text-sage-deep">
                {index + 1}
              </span>
              <div>
                <p className="font-friendly text-[16px] leading-6">{step.title}</p>
                <p className="text-[13px] leading-5 text-ink-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <nav aria-label="Elly 시작 방식" className="grid gap-2.5">
          {HOME_ACTIONS.map((action) =>
            action.id === "demo" ? (
              <FreshDemoButton key={action.id} label={action.label} />
            ) : (
              <Button
                key={action.id}
                href={action.href}
                variant="primary"
                size="lg"
                className="px-5 text-[17px] transition-transform hover:bg-sage-deep-hover active:scale-[0.99]"
                data-ui="H-parent"
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
