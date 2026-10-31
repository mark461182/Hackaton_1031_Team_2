import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elly",
  description: "아이와 부모의 하루를 이어 주는 가족 대화 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
