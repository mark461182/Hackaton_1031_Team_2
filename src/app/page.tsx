import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-3xl font-bold">코끼리</h1>
      <p className="text-center text-gray-600">
        부모님한테 못 하는 말, 코끼리한테는 할 수 있어
      </p>
      <div className="flex w-full flex-col gap-3">
        <Link href="/kid" className="rounded-2xl bg-pink-200 py-4 text-center text-lg font-semibold">
          아이로 시작하기
        </Link>
        <Link href="/parent" className="rounded-2xl bg-violet-200 py-4 text-center text-lg font-semibold">
          부모로 시작하기
        </Link>
      </div>
    </main>
  );
}
