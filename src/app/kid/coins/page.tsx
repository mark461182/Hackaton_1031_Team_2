"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { backgroundForHour, type KokkiriBackground } from "@/components/kokkiri/kokkiri-model";
import { Button } from "@/components/ui/Button";
import { TopBar } from "@/components/ui/TopBar";
import { COINS_PER_TALK, GIFTS, giftCoins } from "@/data/coin-shop";
import { withRo } from "@/lib/korean";
import { getVisitorId, store } from "@/lib/store";
import type { Family } from "@/lib/types";

// 아이 코인 · 기프티콘 고르기 (정적 화면, 가짜 교환 · 03 "만드는 것"). 아이 화면이라 장면 배경과 반말
export default function KidCoinsPage() {
  const [family, setFamily] = useState<Family | null>(null);
  const [background, setBackground] = useState<KokkiriBackground>("peach");
  const [picked, setPicked] = useState<string | null>(null);
  const [bought, setBought] = useState<string | null>(null);

  useEffect(() => {
    setBackground(backgroundForHour(new Date().getHours()));
    store.getOrCreateDemoFamily(getVisitorId()).then(setFamily).catch(() => undefined);
  }, []);

  const coins = family?.coins ?? 0;
  const pickedGift = GIFTS.find((gift) => gift.id === picked);
  const pickedCost = pickedGift ? giftCoins(pickedGift) : 0;

  // 가짜 교환: 코인만 줄고 실제 기프티콘은 보내지 않는다
  async function buy() {
    if (!family || !pickedGift) return;
    try {
      setFamily(await store.spendCoins(family.id, pickedCost));
      setBought(pickedGift.id);
    } catch {
      setBought(null);
    }
  }

  return (
    <main
      className="min-h-dvh bg-kid-sky bg-cover bg-center text-kid-ink"
      style={{ backgroundImage: `url(/kokkiri/bg_hill_${background}.png)` }}
    >
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <TopBar
          columns="wide"
          className="px-4 pt-[env(safe-area-inset-top)]"
          left={
            <Link href="/kid" className="flex min-h-11 items-center" aria-label="Elly랑 이야기하러 가기" data-ui="KS-back">
              <span className="rounded-full bg-surface/85 px-3 py-1 text-[15px]">←</span>
            </Link>
          }
          title={<h1 className="font-friendly text-center text-[18px]">내 코인</h1>}
        />

        <section className="grid gap-3 px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-2">
          <div className="rounded-card bg-surface/90 px-5 py-5 text-center backdrop-blur-md">
            <p className="text-[14px] text-ink-muted">지금 모은 코인</p>
            <p className="font-friendly mt-1 text-[44px] leading-none tabular-nums text-kid-accent">{coins}</p>
            <p className="mt-3 text-[14px] leading-6">Elly랑 이야기를 마치면 하루 한 번 {COINS_PER_TALK}코인을 받아.</p>
          </div>

          <h2 className="font-friendly mt-2 rounded-full bg-surface/85 px-4 py-1 text-[17px] justify-self-start">기프티콘 고르기</h2>
          <div className="grid grid-cols-2 gap-3">
            {GIFTS.map((gift) => {
              const cost = giftCoins(gift);
              return (
                <button
                  key={gift.id}
                  type="button"
                  onClick={() => {
                    setPicked(gift.id);
                    setBought(null);
                  }}
                  aria-pressed={picked === gift.id}
                  className={`grid min-h-[132px] content-start gap-1 rounded-card bg-surface/95 p-4 text-left transition-transform active:scale-[0.98] ${
                    picked === gift.id ? "ring-2 ring-kid-accent" : ""
                  }`}
                  data-ui={`KS-gift-${gift.id}`}
                >
                  <span className="text-[32px] leading-none" aria-hidden="true">
                    {gift.icon}
                  </span>
                  <span className="font-friendly mt-2 text-[16px]">{gift.name}</span>
                  <span className="text-[15px] tabular-nums text-kid-accent">{cost}코인</span>
                </button>
              );
            })}
          </div>

          {pickedGift ? (
            <div role="status" className="grid gap-3 rounded-card bg-surface/95 px-4 py-4 text-[15px] leading-6">
              {bought === pickedGift.id ? (
                <p>
                  {withRo(pickedGift.name)} 바꿨어! 연습 화면이라 진짜 기프티콘은 안 와. 남은 코인은 {coins}개야.
                </p>
              ) : coins >= pickedCost ? (
                <>
                  <p>
                    {withRo(pickedGift.name)} 바꿀까? {pickedCost}코인이 들어.
                  </p>
                  <Button variant="kid" size="sm" className="w-full px-4 text-[16px]" onClick={() => void buy()} data-ui="KS-buy">
                    {pickedCost}코인으로 바꾸기
                  </Button>
                </>
              ) : (
                <p>
                  {pickedGift.name}까지 {pickedCost - coins}코인 더 모으면 돼.
                </p>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
