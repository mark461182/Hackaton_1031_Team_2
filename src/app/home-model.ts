// 첫 화면은 부모용: 아이는 부모가 보낸 아이 링크로 바로 Elly를 만난다
export const HOME_ACTIONS = [
  { id: "parent", href: "/parent", label: "부모로 시작하기" },
  { id: "demo", href: "/demo", label: "예시 가족으로 체험하기" },
] as const;

type DemoResetter = {
  resetDemoFamily(visitorId: string): Promise<unknown>;
};

export async function enterFreshDemo(
  target: DemoResetter,
  visitorId: string,
  navigate: (href: "/demo") => void,
) {
  await target.resetDemoFamily(visitorId);
  navigate("/demo");
}
