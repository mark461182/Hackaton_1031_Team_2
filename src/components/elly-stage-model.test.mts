import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type * as EllyStageModel from "./elly-stage-model";

const require = createRequire(import.meta.url);
const { getEllyImagePresentation } = require("./elly-stage-model.ts") as typeof EllyStageModel;

test("Elly 애니메이션을 사용할 수 있으면 움직이는 이미지와 저감 모션 대체 이미지를 함께 준비한다", () => {
  assert.deepEqual(getEllyImagePresentation(false), {
    showMotion: true,
    showStill: true,
    stillClassName: "elly-still",
  });
});

test("Elly GIF 로드가 실패하면 WebP 대체 이미지만 바로 보여 준다", () => {
  assert.deepEqual(getEllyImagePresentation(true), {
    showMotion: false,
    showStill: true,
    stillClassName: "block",
  });
});
