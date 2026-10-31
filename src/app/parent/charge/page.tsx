"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BottomNav } from "@/components/ui/BottomNav";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { CHARGE_PACKS, COINS_PER_TALK, FEE_RATE, WON_PER_COIN, formatWon } from "@/data/coin-shop";
import { getVisitorId, store } from "@/lib/store";
import { nameSubject } from "@/lib/korean";
import type { Family } from "@/lib/types";

// 부모 코인 충전 (정적 화면, 실제 결제 없음 · 03 "만드는 것")
export default function ParentChargePage() {
  const [family, setFamily] = useState<Family | null>(null);
  const [selected, setSelected] = useState<string>(CHARGE_PACKS[1].id);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    store.getOrCreateDemoFamily(getVisitorId()).then(setFamily).catch(() => undefined);
  }, []);

  const pack = CHARGE_PACKS.find((item) => item.id === selected) ?? CHARGE_PACKS[0];
  const kidName = family?.kidName ?? "아이";

  return (
    <main className="min-h-dvh bg-ivory text-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <TopBar
          className="px-5"
          left={
            <Link href="/parent" className="flex min-h-11 items-center text-[16px]" aria-label="부모 홈으로 돌아가기" data-ui="PG-back">
              ←
            </Link>
          }
          title={<h1 className="font-friendly text-center text-[18px]">코인 충전</h1>}
        />

        <section className="grid gap-4 px-5 pb-8 pt-2">
          <Card tone="sage" className="p-5">
            <p className="text-[14px] text-ink-sage-body">{nameSubject(kidName)} 모은 코인</p>
            <p className="font-friendly mt-1 text-[32px] tabular-nums text-sage-title">
              {family?.coins ?? 0}
              <span className="ml-1 text-[16px]">코인</span>
            </p>
            <p className="mt-2 text-[14px] leading-6 text-ink-sage-body">
              Elly와 대화를 마치면 하루 한 번 {COINS_PER_TALK}코인을 받아요. 모은 코인으로 {nameSubject(kidName)} 기프티콘을 골라요.
            </p>
          </Card>

          <fieldset>
            <legend className="font-friendly mb-3 text-[18px]">충전할 금액</legend>
            <div className="grid gap-2">
              {CHARGE_PACKS.map((item) => (
                <label
                  key={item.id}
                  className={`flex min-h-[60px] cursor-pointer items-center justify-between rounded-card border bg-surface px-5 ${
                    selected === item.id ? "border-sage-deep ring-1 ring-sage-deep" : "border-line-input"
                  }`}
                  data-ui={`PG-pack-${item.id}`}
                >
                  <input
                    type="radio"
                    name="charge-pack"
                    value={item.id}
                    checked={selected === item.id}
                    onChange={() => {
                      setSelected(item.id);
                      setPaid(false);
                    }}
                    className="sr-only"
                  />
                  <span className="font-friendly text-[17px] tabular-nums">{formatWon(item.won)}</span>
                  <span className="text-[15px] tabular-nums text-ink-muted">{item.coins}코인</span>
                </label>
              ))}
            </div>
          </fieldset>

          <Card tone="cream" className="p-4 text-[14px] leading-6 text-ink-muted">
            1코인은 {WON_PER_COIN}원이에요. 기프티콘으로 바꿀 때 상품값에 수수료 {Math.round(FEE_RATE * 100)}%가 붙어요. 화면의 숫자는 예시예요.
          </Card>

          <Button
            size="lg"
            className="w-full px-5 text-[17px] transition-colors hover:bg-sage-deep-hover"
            onClick={() => setPaid(true)}
            data-ui="PG-pay"
          >
            {formatWon(pack.won)} 충전하기
          </Button>
          {paid ? (
            <p role="status" className="rounded-card bg-sage-light px-4 py-3 text-[14px] leading-6 text-ink-sage-body">
              데모 화면이라 실제로 결제하지 않아요. 실제 서비스에서는 여기서 결제가 이어져요.
            </p>
          ) : null}
        </section>

        <BottomNav active="home" />
      </div>
    </main>
  );
}
