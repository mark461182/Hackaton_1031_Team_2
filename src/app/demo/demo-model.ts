export const DEMO_PANELS = [
  { id: "parent", title: "부모 화면", src: "/parent" },
  { id: "kid", title: "아이 화면", src: "/kid" },
] as const;

export type DemoPanelId = (typeof DEMO_PANELS)[number]["id"];

export function getVisibleDemoPanels(mode: "desktop" | "mobile", activeId: DemoPanelId) {
  return mode === "desktop" ? DEMO_PANELS : DEMO_PANELS.filter((panel) => panel.id === activeId);
}
