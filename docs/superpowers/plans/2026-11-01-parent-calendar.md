# Parent Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부모가 `/parent/calendar`에서 예시 가족의 날짜별 대화·사진 표시와 선택한 날의 3줄 일기를 확인할 수 있게 한다.

**Architecture:** `src/data`는 타입에 맞는 예시 `Entry`를 제공하고, 순수한 달력 모델은 월 이동·42칸 날짜 계산·선택일 기록 조회를 담당한다. 클라이언트 페이지는 현재 가족을 `store.ts`로 불러오고 모델 결과만 렌더링하며, API나 Supabase를 직접 호출하지 않는다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, Node test runner

**Spec:** `docs/03_MVP_스펙.md`의 화면·핵심 흐름·데모 체크, `docs/09_역할별_작업.md` 3장

## Global Constraints

- `src/lib/types.ts`, `src/app/api`, `src/lib/llm`, `src/lib/voice`는 수정하지 않는다.
- 부모 화면은 `store.ts`를 통해 가족을 불러오며 Supabase를 직접 호출하지 않는다.
- 대화는 파란 점, 사진은 빨간 점으로 표시한다.
- 3줄 일기는 예시 데이터만 보여 주며 생성 API·사진 업로드는 이번 범위에서 제외한다.
- 기존 Elly 색상·타입·하단 내비게이션을 유지하고 390px 모바일에서 44px 터치 영역을 지킨다.

## Review Focus

- 월 시작 요일이 달라도 항상 6주 42칸을 만들고 날짜가 밀리지 않아야 한다.
- 월 경계를 넘는 예시 기록도 해당 날짜 칸에 표시되어야 한다.
- 같은 날 대화와 사진이 모두 있으면 두 표시가 모두 보여야 한다.
- 일기가 없는 사진 날짜를 선택해도 화면이 깨지지 않고 빈 상태를 보여야 한다.
- 이전·다음 달 이동 뒤 선택 날짜와 월 제목이 서로 어긋나지 않아야 한다.

---

### Task 1: Parent calendar model, sample data, and screen

**Files:**
- Create: `src/app/parent/calendar/calendar-model.test.mts`
- Create: `src/app/parent/calendar/calendar-model.ts`
- Create: `src/data/parent-calendar.ts`
- Create: `src/app/parent/calendar/page.tsx`
- Reuse: `src/components/parent-feed.tsx`

**Interfaces:**
- Consumes: `Entry`, `Family`, `store.getOrCreateDemoFamily(visitorId)`, `ParentBottomNav`
- Produces: `buildCalendarDays(month, entries)`, `shiftMonth(month, amount)`, `getEntriesForDate(entries, date)`, `createParentCalendarEntries(familyId, anchorDate)`

- [ ] **Step 1: Write the failing model tests**

  Test literal expectations for a 42-day grid, chat/photo markers on the same date, selected-date lookup, and month shifting across a year boundary.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `node --test src/app/parent/calendar/calendar-model.test.mts`
  Expected: FAIL because `calendar-model.ts` does not exist.

- [ ] **Step 3: Implement the calendar model and example entries**

  Keep date calculations local and deterministic from an injected `Date`; do not add storage or API behavior.

- [ ] **Step 4: Run the focused test and verify GREEN**

  Run: `node --test src/app/parent/calendar/calendar-model.test.mts`
  Expected: all focused tests pass.

- [ ] **Step 5: Build the `/parent/calendar` client screen**

  Load the family through `store.ts`, render month controls and 42 date buttons, show chat/photo legend and the selected day's diary or empty state, and set `ParentBottomNav active="record"`.

- [ ] **Step 6: Verify the whole repository**

  Run all `*.test.mts` files, `npm run lint`, `npm run build` in an isolated copy, then inspect the production route at 1440, 768, and 390px with the app-screen inspector.

- [ ] **Step 7: Commit**

  Suggested message: `feat: 부모 기록 달력과 예시 일기 추가`
