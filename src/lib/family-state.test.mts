import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import type * as FamilyStateModule from "./family-state";
import type { Family, Message } from "./types";

const require = createRequire(import.meta.url);
const { diffFamilyState, emptyFamilyState, mergeFamilyState, sanitizeFamilyState } = require("./family-state.ts") as typeof FamilyStateModule;

const family: Family = { id: "fam-1", name: "민준네", kidName: "민준", coins: 0, chargedWon: 0 };
const message = (id: string, extra: Partial<Message> = {}): Message => ({
  id,
  familyId: family.id,
  from: "kid",
  text: id,
  createdAt: "2026-11-01T00:00:00.000Z",
  ...extra,
});

test("다른 가족 기록과 엉뚱한 방문자 연결은 지운다", () => {
  const raw = {
    ...emptyFamilyState(family),
    familyIdByVisitor: { "link:fam-1": "fam-1", "visitor-x": "fam-2" },
    families: [family, { ...family, id: "fam-2" }],
    messages: [message("m1"), { ...message("m2"), familyId: "fam-2" }],
  };
  const clean = sanitizeFamilyState(raw, family.id)!;
  assert.deepEqual(clean.familyIdByVisitor, { "link:fam-1": "fam-1" });
  assert.deepEqual(clean.messages.map((m) => m.id), ["m1"]);
  assert.equal(sanitizeFamilyState(raw, "nobody"), null);
});

test("바뀐 기록만 보내서, 오래된 기기가 다른 기기의 변경을 덮지 않는다", () => {
  const base = { ...emptyFamilyState(family), messages: [message("m1")] };
  // 아이 폰: 코인을 씀 (서버에 저장됨)
  const server = mergeFamilyState(base, { families: [{ ...family, coins: 7 }] }, family.id);
  // 부모 폰: 예전 상태(코인 0)에서 메시지 하나만 더함
  const parentNext = { ...base, messages: [...base.messages, message("m2", { from: "kokkiri" })] };
  const patch = diffFamilyState(base, parentNext);
  assert.deepEqual(Object.keys(patch), ["messages"]);
  const merged = mergeFamilyState(server, patch, family.id);
  assert.equal(merged.families[0].coins, 7);
  assert.deepEqual(merged.messages.map((m) => m.id), ["m1", "m2"]);
});

test("같은 기록은 들어온 필드로 덮고, 코인 지급 날짜는 합친다", () => {
  const base = { ...emptyFamilyState(family), messages: [message("m1")], coinAwardDays: { "fam-1": ["2026-10-31"] } };
  const merged = mergeFamilyState(
    base,
    { messages: [message("m1", { keepFromParent: "share_declined" })], coinAwardDays: { "fam-1": ["2026-11-01"] } },
    family.id,
  );
  assert.equal(merged.messages[0].keepFromParent, "share_declined");
  assert.deepEqual(merged.coinAwardDays["fam-1"], ["2026-10-31", "2026-11-01"]);
});
