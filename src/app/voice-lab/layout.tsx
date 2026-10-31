import { notFound } from "next/navigation";

// 개발용 실험실은 운영 주소에서 숨긴다 (11/1 도하 결정 D12). 미리보기 배포와 로컬에서는 열린다
export default function VoiceLabLayout({ children }: { children: React.ReactNode }) {
  if (process.env.VERCEL_ENV === "production") notFound();
  return children;
}
