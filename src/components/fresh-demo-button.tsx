"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { enterFreshDemo } from "@/app/home-model";
import { getVisitorId, store } from "@/lib/store";

import { Button } from "./ui/Button";

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
      <Button
        variant="text"
        size="xs"
        disabled={state === "pending"}
        onClick={() => void handleClick()}
        className="font-friendly text-[17px] decoration-1 disabled:cursor-wait disabled:opacity-60"
        data-ui="H-sample"
      >
        {state === "pending" ? "예시 가족을 준비하는 중…" : label}
      </Button>
      {state === "error" && (
        <p role="alert" className="text-[13px] leading-5 text-danger-ink">
          준비하지 못했어요. 다시 눌러 주세요.
        </p>
      )}
    </div>
  );
}
