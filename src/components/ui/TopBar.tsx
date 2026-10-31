import type { ReactNode } from "react";

/** wide: 아이 화면 (왼쪽 64 · 가운데 · 오른쪽 80), narrow: 부모 화면 (44 · 가운데 · 44) */
const COLUMNS = {
  wide: "grid-cols-[64px_1fr_80px]",
  narrow: "grid-cols-[44px_1fr_44px]",
} as const;

type TopBarProps = {
  left: ReactNode;
  title: ReactNode;
  /** 비우면 빈 칸 */
  right?: ReactNode;
  columns?: keyof typeof COLUMNS;
  /** 좌우 여백 등 */
  className?: string;
};

/** 화면 맨 위 줄: 왼쪽(뒤로) · 제목 · 오른쪽 */
export function TopBar({ left, title, right, columns = "narrow", className }: TopBarProps) {
  return (
    <header className={["grid min-h-[52px]", COLUMNS[columns], "items-center", className ?? ""].filter(Boolean).join(" ")}>
      {left}
      {title}
      {right ?? <span />}
    </header>
  );
}
