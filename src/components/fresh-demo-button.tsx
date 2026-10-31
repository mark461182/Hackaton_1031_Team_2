"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { enterFreshDemo } from "@/app/home-model";
import { getVisitorId, store } from "@/lib/store";

type FreshDemoButtonProps = {
  label: string;
};

export function FreshDemoButton({ label }: FreshDemoButtonProps) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");

  async function handleClick() {
    if (state === "pending") return;

    setState("pending");
    try {
      await enterFreshDemo(store, getVisitorId(), (href) => router.push(href));
    } catch {
      setState("error");
    }
  }

  return (
    <div className="grid justify-items-center">
      <button
        type="button"
        disabled={state === "pending"}
        onClick={() => void handleClick()}
        className="font-friendly min-h-11 text-[17px] text-[#383D37] underline decoration-[#728F7A] decoration-1 underline-offset-4 disabled:cursor-wait disabled:opacity-60"
      >
        {state === "pending" ? "예시 가족을 준비하는 중…" : label}
      </button>
      {state === "error" && (
        <p role="alert" className="text-[13px] leading-5 text-[#873B32]">
          준비하지 못했어요. 다시 눌러 주세요.
        </p>
      )}
    </div>
  );
}
