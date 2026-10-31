import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type * as HomeModel from "./home-model";

const require = createRequire(import.meta.url);
const { HOME_ACTIONS, enterFreshDemo } = require("./home-model.ts") as typeof HomeModel;

test("첫 화면은 부모 시작·예시 가족 체험만 정확한 주소로 연결한다", () => {
  assert.deepEqual(
    HOME_ACTIONS.map(({ id, href }) => ({ id, href })),
    [
      { id: "parent", href: "/parent" },
      { id: "demo", href: "/demo" },
    ],
  );
  assert.equal(HOME_ACTIONS.find((action) => action.id === "demo")?.label, "예시 가족으로 체험하기");
});

test("예시 가족 체험은 기존 가족을 초기화한 뒤 데모로 이동한다", async () => {
  const events: string[] = [];

  await enterFreshDemo(
    {
      async resetDemoFamily(visitorId: string) {
        events.push(`reset:${visitorId}`);
      },
    },
    "visitor-jaemo",
    (href: string) => events.push(`navigate:${href}`),
  );

  assert.deepEqual(events, ["reset:visitor-jaemo", "navigate:/demo"]);
});
