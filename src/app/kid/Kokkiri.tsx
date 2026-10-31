"use client";

// 코끼리 그림: 도하가 public/kokkiri/{상태}.{png|webp|svg}에 넣으면 자동으로 쓰고, 없으면 임시 자리 표시 (docs/09 1장 5번)
import { useState } from "react";

export type KokkiriState = "idle" | "listening" | "thinking" | "speaking";

const EXTS = ["png", "webp", "svg"];
const LABEL: Record<KokkiriState, string> = { idle: "", listening: "듣고 있어", thinking: "음…", speaking: "" };

export function Kokkiri({ state }: { state: KokkiriState }) {
  const [extIdx, setExtIdx] = useState(0);
  const [missing, setMissing] = useState(false);

  return (
    <div className="flex flex-col items-center gap-2">
      {missing ? (
        <div
          className={`flex h-44 w-44 items-center justify-center rounded-full bg-violet-100 text-7xl transition-transform ${
            state === "speaking" ? "animate-bounce" : state === "thinking" ? "animate-pulse" : ""
          } ${state === "listening" ? "ring-8 ring-pink-200" : ""}`}
          aria-label="코끼리"
        >
          🐘
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/kokkiri/${state}.${EXTS[extIdx]}`}
          alt="코끼리"
          className={`h-44 w-44 object-contain ${state === "speaking" ? "animate-bounce" : ""}`}
          onError={() => (extIdx + 1 < EXTS.length ? setExtIdx(extIdx + 1) : setMissing(true))}
        />
      )}
      <p className="h-5 text-sm text-gray-500">{LABEL[state]}</p>
    </div>
  );
}
