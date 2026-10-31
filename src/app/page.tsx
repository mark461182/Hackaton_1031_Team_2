import Link from "next/link";

import { EllyStage } from "@/components/elly-stage";
import { FreshDemoButton } from "@/components/fresh-demo-button";

import { HOME_ACTIONS } from "./home-model";

export default function Home() {
  return (
    <main className="min-h-dvh bg-[#F7F4EC] text-[#383D37]">
      <section className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-8">
        <header>
          <p className="font-friendly text-[18px] text-[#4F6F59]">Elly</p>
          <h1 className="font-friendly mt-3 text-[28px] leading-[1.3] tracking-[-0.02em]">
            아이와 부모의 하루를<br />따뜻하게 이어 줘요
          </h1>
          <p className="mt-3 max-w-[32ch] text-[15px] leading-6 text-[#5E655C]">
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
              <Link
                key={action.id}
                href={action.href}
                className={`font-friendly flex items-center justify-center rounded-2xl px-5 text-[17px] transition-transform active:scale-[0.99] ${
                  action.id === "kid"
                    ? "min-h-[56px] bg-[#4F6F59] text-white hover:bg-[#435F4B]"
                    : "min-h-[52px] bg-[#DCE8D8] text-[#383D37] hover:bg-[#D1E0CD]"
                }`}
              >
                {action.label}
              </Link>
            ),
          )}
        </nav>
      </section>
    </main>
  );
}
