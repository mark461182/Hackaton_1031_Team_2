import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type * as DemoModel from "./demo-model";

const require = createRequire(import.meta.url);
const { DEMO_PANELS, getVisibleDemoPanels } = require("./demo-model.ts") as typeof DemoModel;

test("두 폰 데모는 부모 화면 다음 아이 화면을 정확한 경로로 제공한다", () => {
  assert.equal(DEMO_PANELS.length, 2);
  assert.deepEqual(
    DEMO_PANELS.map(({ id, src }) => ({ id, src })),
    [
      { id: "parent", src: "/parent" },
      { id: "kid", src: "/kid" },
    ],
  );
  assert.equal(DEMO_PANELS.every((panel) => panel.title.trim().length > 0), true);
});

test("모바일은 선택한 한 화면만, 데스크톱은 두 화면을 모두 보여 준다", () => {
  assert.deepEqual(getVisibleDemoPanels("mobile", "kid").map((panel) => panel.id), ["kid"]);
  assert.deepEqual(getVisibleDemoPanels("mobile", "parent").map((panel) => panel.id), ["parent"]);
  assert.deepEqual(getVisibleDemoPanels("desktop", "kid").map((panel) => panel.id), ["parent", "kid"]);
});
