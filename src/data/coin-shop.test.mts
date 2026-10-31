import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type * as CoinShop from "./coin-shop";

const require = createRequire(import.meta.url);
const { formatWon, giftCoins } = require("./coin-shop.ts") as typeof CoinShop;

test("기프티콘 코인은 상품값에 수수료를 더해 코인 값으로 나누고 올림한다", () => {
  assert.equal(giftCoins({ priceWon: 1_500 }), 17); // 1,650원
  assert.equal(giftCoins({ priceWon: 2_000 }), 22); // 2,200원
  assert.equal(giftCoins({ priceWon: 10_000 }), 110); // 11,000원
});

test("원 단위는 쉼표를 넣어 보여 준다", () => {
  assert.equal(formatWon(30_000), "30,000원");
});
