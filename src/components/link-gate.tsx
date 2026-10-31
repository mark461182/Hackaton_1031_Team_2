"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { activeFamilyLink, familyLinkAvailable, fetchFamilyState, isDemoContext, saveFamilyLink } from "@/lib/family-link";

type GateStatus = "checking" | "ready" | "linking" | "need-link" | "bad-link";

/**
 * 링크로 들어오기: /kid?k=열쇠, /parent?p=열쇠 를 이 기기에 저장하고 주소에서 열쇠를 지운 뒤 다시 연다
 * 아이 화면은 링크가 없으면 열지 않는다 (데모는 예외). 아이에게 부모와 연결된다는 말은 하지 않는다
 */
export function LinkGate({ role, children }: { role: "parent" | "kid"; children: React.ReactNode }) {
  const [status, setStatus] = useState<GateStatus>("checking");

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get(role === "kid" ? "k" : "p");
    if (key && !isDemoContext()) {
      setStatus("linking");
      fetchFamilyState(key)
        .then((body) => {
          if (!body || body.role !== role) {
            setStatus("bad-link");
            return;
          }
          saveFamilyLink({ role, key, familyId: body.familyId, kidKey: body.kidKey }, body.state);
          window.location.replace(window.location.pathname);
        })
        .catch(() => setStatus("bad-link"));
      return;
    }
    if (role === "kid" && !isDemoContext() && !activeFamilyLink()) {
      // 링크 저장소가 없는 배포면 막지 않는다 (예전처럼 한 기기 안에서)
      void familyLinkAvailable().then((available) => setStatus(available ? "need-link" : "ready"));
      return;
    }
    setStatus("ready");
  }, [role]);

  if (status === "ready") return <>{children}</>;

  const message =
    status === "need-link"
      ? "Elly를 만나려면 엄마 아빠한테 받은 링크로 들어와 줘."
      : status === "bad-link"
        ? role === "kid"
          ? "이 링크로는 들어갈 수 없어. 엄마 아빠한테 새 링크를 받아 줘."
          : "이 부모 링크는 맞지 않아요. 아이 링크를 만든 기기에서 다시 확인해 주세요."
        : "잠깐만, 여는 중이야.";

  return (
    <main className={`grid min-h-dvh place-items-center px-6 text-center ${role === "kid" ? "bg-kid-sky text-kid-ink" : "bg-ivory text-ink"}`}>
      <div className="grid max-w-xs gap-4">
        <p className="font-friendly text-[18px] leading-7" role="status">
          {status === "checking" ? "" : message}
        </p>
        {status === "need-link" || status === "bad-link" ? (
          <Link href="/demo" className="text-[14px] underline underline-offset-4" data-ui="LG-demo">
            예시 가족으로 체험하기
          </Link>
        ) : null}
      </div>
    </main>
  );
}
