import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");

test("Pretendard는 본문용 400과 강조용 600 실제 폰트를 제공한다", () => {
  assert.match(css, /Pretendard-Regular\.woff2/);
  assert.match(css, /font-weight:\s*400/);
  assert.match(css, /Pretendard-SemiBold\.woff2/);
  assert.match(css, /font-weight:\s*600/);
  assert.match(css, /body\s*\{[^}]*font-weight:\s*400/s);
});
