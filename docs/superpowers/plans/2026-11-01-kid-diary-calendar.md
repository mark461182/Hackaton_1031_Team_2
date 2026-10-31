# Kid Diary Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 아이가 대화를 마치면 기존 `/api/kid/done`의 3줄 일기를 저장하고 `/kid/calendar`에서 해당 날짜의 파란 점과 일기를 확인할 수 있게 한다.

**Architecture:** `/kid`는 저장된 당일 메시지를 `/api/kid/done`에 보내고, 검증한 응답을 `Entry`로 만들어 `store.ts`에 저장한다. 브라우저 메모리 저장소는 가족·날짜·종류별로 기록을 하나만 유지하고, `/kid/calendar`는 store 함수로만 기록을 읽어 월 달력 모델을 렌더링한다.

**Tech Stack:** Next.js App Router, React, TypeScript, Node test runner, 기존 browser-memory store

**Spec:** `docs/03_MVP_스펙.md`

## Global Constraints

- `src/app/api`, `src/lib/llm`, `src/lib/voice`, `src/lib/types.ts`는 수정하지 않는다.
- 화면은 Supabase를 직접 부르지 않고 `store.ts` 함수만 부른다.
- 코끼리 말투·대사를 새로 만들지 않고 `/api/kid/done` 응답을 그대로 사용한다.
- 아이 화면에 부모 전달 문구를 넣지 않는다.
- 새 패키지를 설치하지 않고 현재의 단순한 시각 언어를 따른다.

## Review Focus

- 잘못된 `/api/kid/done` 응답은 저장하지 않고 아이가 다시 시도할 수 있어야 한다.
- 같은 날 대화를 여러 번 마쳐도 대화 기록과 파란 점은 한 개여야 한다.
- 다른 가족의 일기는 서로 보이지 않아야 한다.
- 브라우저를 다시 열어도 저장한 일기와 파란 점이 남아야 한다.
- 기록이 없는 달력도 오류 없이 빈 상태를 보여야 한다.

---

### Task 1: 일기 기록 저장소

**Files:**
- Modify: `src/lib/store.ts`
- Test: `src/lib/store.test.mts`

**Interfaces:**
- Consumes: `Entry` from `src/lib/types.ts`
- Produces: `saveEntry(entry: Entry): Promise<void>`, `getEntries(familyId: Id): Promise<Entry[]>`

- [x] **Step 1: 저장·가족 격리·동일 날짜 덮어쓰기·브라우저 복원 실패 테스트 작성**
- [x] **Step 2: `node --experimental-strip-types --test 'src/**/*.test.mts'`를 실행해 새 테스트가 메서드 부재로 실패하는지 확인**
- [x] **Step 3: persisted state에 `entries`를 선택 필드로 추가하고 두 store 메서드를 최소 구현**
- [x] **Step 4: `node --experimental-strip-types --test 'src/**/*.test.mts'`를 실행해 통과 확인**

### Task 2: 대화 종료 일기 변환과 저장 연결

**Files:**
- Create: `src/app/kid/diary-model.ts`
- Create: `src/app/kid/diary-model.test.mts`
- Modify: `src/app/kid/page.tsx`

**Interfaces:**
- Consumes: `KidDoneRequest`, `KidDoneResponse`, `Entry`, `Message`, `Family`, `store.saveEntry`
- Produces: `buildKidDoneRequest`, `parseKidDoneResponse`, `createChatDiaryEntry`

- [x] **Step 1: 요청의 제외 표시 보존, 정확히 3개의 비어 있지 않은 줄 검증, Entry 변환 실패 테스트 작성**
- [x] **Step 2: `node --experimental-strip-types --test 'src/**/*.test.mts'`를 실행해 모듈 부재로 실패하는지 확인**
- [x] **Step 3: 세 순수 함수를 구현하고 `/kid`의 종료 응답 뒤 API 호출·store 저장·달력 링크를 연결**
- [x] **Step 4: `node --experimental-strip-types --test 'src/**/*.test.mts'`를 실행해 통과 확인**

### Task 3: 아이 기록 달력

**Files:**
- Create: `src/app/kid/calendar/calendar-model.ts`
- Create: `src/app/kid/calendar/calendar-model.test.mts`
- Create: `src/app/kid/calendar/page.tsx`

**Interfaces:**
- Consumes: `store.getEntries(familyId)`, `getVisitorId()`, `Entry`
- Produces: `buildCalendarMonth(year: number, monthIndex: number, entries: Entry[])`

- [x] **Step 1: 월 앞뒤 빈칸, 날짜별 chat 기록, 기록 없는 달의 실패 테스트 작성**
- [x] **Step 2: `node --experimental-strip-types --test 'src/**/*.test.mts'`를 실행해 모듈 부재로 실패하는지 확인**
- [x] **Step 3: 달력 모델과 파란 점·선택 날짜 3줄 일기·빈 상태를 갖는 모바일 화면 구현**
- [x] **Step 4: `node --experimental-strip-types --test 'src/**/*.test.mts'`, `npm run lint`, `npm run build`를 실행해 전체 검증**
- [x] **Step 5: `/kid` 종료 흐름과 `/kid/calendar`를 모바일·태블릿·데스크톱에서 브라우저 확인**
