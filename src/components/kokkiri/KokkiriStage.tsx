"use client";

import { useEffect, useRef } from "react";

import { backgroundForHour, type KokkiriBackground } from "./kokkiri-model";
import { KokkiriPlayer } from "./kokkiri-player";
import "./kokkiri.css";

type KokkiriStageProps = {
  /** 플레이어를 만든 직후 한 번 부른다. 상태 바꾸기(setState)·말하기(speak)에 쓴다 */
  onReady?: (kk: KokkiriPlayer) => void;
  /** 없으면 지금 시각으로 고른다 */
  background?: KokkiriBackground;
  className?: string;
  /** --kk-ground(발 닿는 높이)·--kk-size(코끼리 크기) 같은 CSS 변수 */
  style?: React.CSSProperties;
  /** 무대 위에 얹는 말풍선·버튼. 코끼리보다 위에 그린다 */
  children?: React.ReactNode;
};

// 플레이어가 배경·코끼리를 직접 넣는 층과 React가 그리는 층을 나눈다 (서로의 DOM을 건드리지 않게)
export function KokkiriStage({ onReady, background, className = "", style, children }: KokkiriStageProps) {
  const stage = useRef<HTMLDivElement>(null);
  const player = useRef<KokkiriPlayer | null>(null);

  useEffect(() => {
    if (!stage.current) return;
    const kk = new KokkiriPlayer(stage.current, {
      base: "/kokkiri/",
      bg: background ?? backgroundForHour(new Date().getHours()),
    });
    player.current = kk;
    void kk.load();
    onReady?.(kk);
    return () => {
      kk.destroy();
      player.current = null;
    };
    // 플레이어는 한 번만 만든다. 배경은 아래에서 바꾼다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (background) player.current?.setBackground(background);
  }, [background]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      <div ref={stage} className="absolute inset-0 overflow-hidden" aria-hidden="true" />
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </div>
  );
}
