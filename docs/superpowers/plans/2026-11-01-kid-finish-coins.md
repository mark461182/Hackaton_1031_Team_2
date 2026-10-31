# Kid Finish Coins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 아이가 충분히 대화한 뒤 대화를 마치면 코인 10개를 받고, 같은 날 반복 종료로는 다시 받지 않게 한다.

**Architecture:** 기존 `/api/kid/chat`의 `endConversation` 신호를 그대로 사용한다. 화면은 종료 응답을 받은 뒤에만 `store.finishConversation`을 호출하고, 저장 계층이 최소 아이 메시지 3개·가족별 UTC 날짜당 1회 규칙과 코인 변경을 한 번에 처리한다.

**Tech Stack:** Next.js App Router, React, TypeScript, Node 내장 테스트 러너, 브라우저 메모리/localStorage store

**Spec:** `docs/03_MVP_스펙.md` 핵심 흐름의 코인 줄과 데모 체크의 대화 마치기 항목

## Global Constraints

- `src/lib/types.ts`, `src/app/api/**`, `src/lib/llm/**`, `src/lib/voice/**`는 수정하지 않는다.
- 화면은 Supabase를 직접 부르지 않고 `src/lib/store.ts`만 호출한다.
- 코끼리 말투·대사는 새로 만들지 않는다.
- 아이 화면에는 부모에게 전달된다는 말을 넣지 않는다.
- 코인 규칙은 아이 메시지 3개 이상, 완료 1회당 10개, 가족별 UTC 날짜당 최대 1회다.

## Review Focus

- 아이 메시지가 3개보다 적으면 코인이 지급되지 않아야 한다.
- 같은 날 종료를 반복해도 총 코인은 10개만 증가해야 한다.
- 다음 날 충분히 대화하고 종료하면 다시 10개를 받을 수 있어야 한다.
- 다른 가족의 종료 기록이 현재 가족의 지급을 막지 않아야 한다.
- 브라우저 저장소를 다시 열어도 지급 기록과 코인이 유지되어야 한다.

---

### Task 1: 저장 계층의 코인 지급 규칙

**Files:**
- Modify: `src/lib/store.ts`
- Modify: `src/lib/store.test.mts`
- Modify: `docs/03_MVP_스펙.md`

**Interfaces:**
- Produces: `finishConversation(familyId: Id, finishedAt: IsoTime): Promise<FinishConversationResult>`
- Produces: `FinishConversationResult` with `status: "awarded" | "too_short" | "already_awarded"`, `coins`, `awardedCoins`

- [ ] **Step 1: Write failing tests for minimum turns, once-per-day, next-day, family isolation, and browser persistence**
- [ ] **Step 2: Run `node --experimental-strip-types --test src/lib/store.test.mts` and confirm the new tests fail because the method is missing**
- [ ] **Step 3: Add persisted coin-award day keys and implement `finishConversation` atomically in `src/lib/store.ts`**
- [ ] **Step 4: Record `아이 메시지 3개 이상 · 10코인 · 하루 1회` in `docs/03_MVP_스펙.md`**
- [ ] **Step 5: Re-run the store tests and confirm they pass**

### Task 2: 아이 화면 종료 버튼 연결

**Files:**
- Modify: `src/app/kid/chat-model.ts`
- Modify: `src/app/kid/chat-model.test.mts`
- Modify: `src/app/kid/page.tsx`

**Interfaces:**
- Consumes: `store.finishConversation(familyId, finishedAt)` from Task 1
- Produces: a pure result-to-notice mapper for testable UI state

- [ ] **Step 1: Write failing tests for awarded, too-short, and already-awarded notices**
- [ ] **Step 2: Run the chat-model tests and confirm the mapper is missing**
- [ ] **Step 3: Add the mapper, a `대화 마치기` button that sends `끝`, and call `finishConversation` only when API returns `endConversation: true`**
- [ ] **Step 4: Show current coin count and the store result without adding elephant dialogue**
- [ ] **Step 5: Run focused tests, lint, build, and `git diff --check`**
