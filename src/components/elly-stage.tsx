"use client";

import Image, { type StaticImageData } from "next/image";
import { useState } from "react";

import cryGif from "@/lib/elly/elephant_cry.gif";
import cryWebp from "@/lib/elly/elephant_cry.webp";
import excitedGif from "@/lib/elly/elephant_excited.gif";
import excitedWebp from "@/lib/elly/elephant_excited.webp";
import greetGif from "@/lib/elly/elephant_greet.gif";
import greetWebp from "@/lib/elly/elephant_greet.webp";
import listenGif from "@/lib/elly/elephant_listen.gif";
import listenWebp from "@/lib/elly/elephant_listen.webp";
import thinkGif from "@/lib/elly/elephant_think.gif";
import thinkWebp from "@/lib/elly/elephant_think.webp";

import type { EllyAsset } from "@/app/kid/chat-model";

import { getEllyImagePresentation } from "./elly-stage-model";

const assets: Record<EllyAsset, { motion: StaticImageData; still: StaticImageData; alt: string }> = {
  greet: { motion: greetGif, still: greetWebp, alt: "반갑게 인사하는 Elly" },
  listen: { motion: listenGif, still: listenWebp, alt: "귀 기울여 듣는 Elly" },
  think: { motion: thinkGif, still: thinkWebp, alt: "곰곰이 생각하는 Elly" },
  excited: { motion: excitedGif, still: excitedWebp, alt: "신나게 이야기하는 Elly" },
  cry: { motion: cryGif, still: cryWebp, alt: "마음을 함께 살피는 Elly" },
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
  const [failedAsset, setFailedAsset] = useState<EllyAsset | null>(null);
  const presentation = getEllyImagePresentation(failedAsset === asset);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center text-center">
      <div className={`relative ${imageClass}`}>
        {presentation.showMotion && (
          <Image
            alt={selected.alt}
            className="elly-motion object-contain"
            fill
            onError={() => setFailedAsset(asset)}
            priority={priority}
            sizes={compact ? "220px" : "290px"}
            src={selected.motion}
            unoptimized
          />
        )}
        {presentation.showStill && (
          <Image
            alt={selected.alt}
            className={`${presentation.stillClassName} object-contain`}
            fill
            priority={priority}
            sizes={compact ? "220px" : "290px"}
            src={selected.still}
          />
        )}
      </div>
      <p className="font-friendly mt-1 text-[18px] leading-7 text-[#383D37]">{status}</p>
      {children}
    </div>
  );
}
