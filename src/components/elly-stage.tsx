"use client";

import Image from "next/image";

import type { EllyAsset } from "@/app/kid/chat-model";

// 아이 화면 영상과 같은 파란 코끼리의 정지 그림 (11/1 도하 결정 D1). 원본은 public/kokkiri/*.png
const assets: Record<EllyAsset, { src: string; alt: string }> = {
  greet: { src: "/kokkiri/still/idle.png", alt: "반갑게 인사하는 Elly" },
  listen: { src: "/kokkiri/still/listening.png", alt: "귀 기울여 듣는 Elly" },
  think: { src: "/kokkiri/still/thinking.png", alt: "곰곰이 생각하는 Elly" },
  excited: { src: "/kokkiri/still/speaking.png", alt: "신나게 이야기하는 Elly" },
  cry: { src: "/kokkiri/still/listening.png", alt: "마음을 함께 살피는 Elly" },
};

type EllyStageProps = {
  asset: EllyAsset;
  status: string;
  compact?: boolean;
  priority?: boolean;
  children?: React.ReactNode;
};

export function EllyStage({
  asset,
  status,
  compact = false,
  priority = false,
  children,
}: EllyStageProps) {
  const selected = assets[asset];
  const imageClass = compact ? "h-[190px] w-[220px]" : "h-[270px] w-[290px]";

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
      <div className={`relative ${imageClass}`}>
        <Image
          alt={selected.alt}
          className="object-contain"
          fill
          priority={priority}
          sizes={compact ? "220px" : "290px"}
          src={selected.src}
        />
      </div>
      <p className="font-friendly mt-1 text-[18px] leading-7 text-ink">{status}</p>
      {children}
    </div>
  );
}
