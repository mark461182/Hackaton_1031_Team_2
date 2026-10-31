import type { ComponentPropsWithoutRef } from "react";

/** 카드 바탕색 — 값은 globals.css @theme */
const TONE = {
  surface: "bg-surface", // 흰 카드
  sage: "bg-sage-light", // 연한 세이지 카드
  cream: "bg-cream", // 크림 카드
  danger: "bg-danger-bg", // 마음 살펴보기 카드
} as const;

export type CardTone = keyof typeof TONE;

type CardProps = ComponentPropsWithoutRef<"article"> & {
  tone?: CardTone;
  "data-ui"?: string;
};

/** 둥근 카드 (모서리 rounded-card). 여백은 className으로 */
export function Card({ tone = "surface", className, ...rest }: CardProps) {
  return <article {...rest} className={["rounded-card", TONE[tone], className ?? ""].filter(Boolean).join(" ")} />;
}
