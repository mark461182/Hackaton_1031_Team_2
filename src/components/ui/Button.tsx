import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "listening"
  | "secondary"
  | "surface"
  | "ghost"
  | "text"
  | "kid"
  | "kid-listening"
  | "kid-soft";
export type ButtonSize = "xl" | "lg" | "md" | "sm" | "xs";

/** 버튼 종류별 모양 — 여기서 바꾸면 같은 종류 버튼이 모두 바뀐다. 색 값은 globals.css @theme */
const VARIANT: Record<ButtonVariant, string> = {
  primary: "font-friendly rounded-btn bg-sage-deep text-on-sage", // 진한 세이지 주 버튼
  listening: "font-friendly rounded-btn bg-sage-muted text-ink-on-muted", // 꾹 눌러 말하는 동안의 말하기 버튼
  secondary: "font-friendly rounded-btn bg-sage-light text-ink", // 연한 세이지 보조 버튼
  surface: "font-friendly rounded-btn bg-surface text-ink", // 흰 버튼
  ghost: "font-friendly rounded-btn text-ink-muted", // 바탕 없는 버튼
  text: "text-ink underline decoration-sage-muted underline-offset-4", // 밑줄 글자 버튼
  kid: "font-friendly rounded-full bg-kid-accent text-on-sage shadow-lg shadow-kid-accent/30", // 아이 화면 말하기 버튼 (코끼리 파랑 알약)
  "kid-listening": "font-friendly rounded-full bg-kid-accent-pressed text-on-sage", // 아이 화면, 꾹 누르는 동안
  "kid-soft": "font-friendly rounded-full bg-surface/90 text-kid-ink", // 아이 화면 장면 위 흰 알약 (선택지·보내기)
};

/** 버튼 높이 (최소 높이) */
const SIZE: Record<ButtonSize, string> = {
  xl: "min-h-[64px]",
  lg: "min-h-[56px]",
  md: "min-h-[52px]",
  sm: "min-h-12", // 48px
  xs: "min-h-11", // 44px
};

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 여백·글자 크기·hover·disabled처럼 버튼마다 다른 것 */
  className?: string;
  children?: ReactNode;
  /** 디자인 이름표 (예: "K-start") */
  "data-ui"?: string;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { href?: undefined };
type ButtonAsLink = CommonProps & Omit<ComponentProps<typeof Link>, keyof CommonProps>;

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function buttonClassName({
  variant = "primary",
  size,
  className,
  asLink = false,
}: Pick<CommonProps, "variant" | "size" | "className"> & { asLink?: boolean }) {
  return [
    // 링크 버튼은 글자를 가운데로 (글자 버튼 제외)
    asLink && variant !== "text" ? "flex items-center justify-center" : "",
    VARIANT[variant],
    size ? SIZE[size] : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** href가 있으면 Next 링크, 없으면 <button> */
export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { variant, size, className, ...rest } = props as ButtonAsLink;
    return <Link {...rest} className={buttonClassName({ variant, size, className, asLink: true })} />;
  }
  const { variant, size, className, type = "button", ...rest } = props as ButtonAsButton;
  return <button {...rest} type={type} className={buttonClassName({ variant, size, className })} />;
}
