import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type * as KokkiriModel from "./kokkiri-model";

const require = createRequire(import.meta.url);
const { backgroundForHour } = require("./kokkiri-model.ts") as typeof KokkiriModel;

test("낮(6시~17시)에는 살구빛 아침 배경을 쓴다", () => {
  for (const hour of [6, 9, 12, 17]) assert.equal(backgroundForHour(hour), "peach");
});

test("밤(18시~다음 날 5시)에는 노란 오후 배경을 쓴다", () => {
  for (const hour of [18, 21, 0, 5]) assert.equal(backgroundForHour(hour), "golden");
});
