# Parent Weekly Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부모 달력에서 이번 주 리포트를 발견하고 `/parent/report`에서 요약과 다음 주 추천 질문을 읽을 수 있게 한다.

**Architecture:** 정적 예시 리포트 생성은 `src/data/parent-report.ts`, 날짜 계산과 표시 모델은 `src/app/parent/report/report-model.ts`에 둔다. 달력은 짧은 미리보기 링크만 추가하고 전체 내용은 새 `/parent/report` 화면이 기존 Parent 내비게이션 안에서 보여 준다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Node test runner

**Spec:** `docs/superpowers/specs/2026-11-01-parent-weekly-report-design.md`

## Global Constraints

- 정적 예시 데이터만 사용하고 API·LLM·Supabase 저장을 추가하지 않는다.
- `src/lib/types.ts`, `src/app/api/**`, `src/lib/llm/**`, `src/lib/voice/**`를 수정하지 않는다.
- 진단·판정 표현, 서비스 이름, 가격을 새로 정하지 않는다.
- 부모 제외 내용이나 거절한 공유 내용은 예시 리포트에 넣지 않는다.
- 모바일 한 칸과 `/demo` 안의 폰 너비에서 읽을 수 있어야 한다.

## Review Focus

- 일요일을 기준일로 받아도 주간 범위가 이전 월요일부터 해당 일요일까지 정확해야 한다 — Task 1 날짜 테스트.
- 월이나 연도가 바뀌는 주도 기간 문구가 틀어지지 않아야 한다 — Task 1 경계 테스트.
- 가족 ID와 아이 이름이 다른 방문자 사이에서 섞이지 않아야 한다 — Task 1 데이터 테스트.
- 추천 질문은 정확히 3개이며 예/아니오를 유도하지 않는 열린 질문이어야 한다 — Task 1 콘텐츠 테스트.
- 가족 데이터를 불러오지 못해도 화면이 빈 채로 죽지 않고 부모 달력으로 돌아갈 길을 보여야 한다 — Task 2 오류 상태 구현과 build 검증.

---

## File Structure

- Create: `src/data/parent-report.ts` — 가족별 정적 리포트 예시 생성과 화면용 타입.
- Create: `src/app/parent/report/report-model.ts` — 월요일~일요일 계산과 기간 표시.
- Create: `src/app/parent/report/report-model.test.mts` — 날짜 경계와 예시 콘텐츠 검증.
- Create: `src/app/parent/report/page.tsx` — 전체 주간 리포트 화면.
- Modify: `src/app/parent/calendar/page.tsx` — 이번 주 미리보기와 리포트 링크.

### Task 1: 주간 리포트 모델과 예시 데이터

**Files:**
- Create: `src/app/parent/report/report-model.test.mts`
- Create: `src/app/parent/report/report-model.ts`
- Create: `src/data/parent-report.ts`

**Interfaces:**
- Produces: `getWeekRange(anchorDate: Date): { start: IsoDate; end: IsoDate }`
- Produces: `formatWeekRange(start: IsoDate, end: IsoDate): string`
- Produces: `createParentWeeklyReport(familyId: Id, kidName: string, week: IsoDate): ParentWeeklyReport`
- Produces: `ParentWeeklyReport` with `id`, `familyId`, `week`, `summary`, `highlights`, `nextQuestions`

- [ ] **Step 1: 실패하는 모델 테스트 작성**
  - 2026-11-01 일요일의 범위가 `2026-10-26`~`2026-11-01`인지 검증한다.
  - 연도 경계 기간 문구가 시작·끝 날짜를 모두 포함하는지 검증한다.
  - 다른 가족 ID와 아이 이름으로 만든 데이터가 섞이지 않는지 검증한다.
  - 추천 질문이 정확히 3개이고 모두 `?`로 끝나는지 검증한다.

- [ ] **Step 2: RED 확인**
  - Run: `node --experimental-strip-types --test src/app/parent/report/report-model.test.mts`
  - Expected: 모듈이 없어 실패.

- [ ] **Step 3: 최소 모델과 예시 데이터 구현**
  - `getWeekRange`는 로컬 정오 기준으로 월요일~일요일을 계산한다.
  - `formatWeekRange`는 같은 연도면 `M월 D일 – M월 D일`, 연도가 다르면 `YYYY년 M월 D일 – YYYY년 M월 D일`로 표시한다.
  - `createParentWeeklyReport`는 가족별 ID, 아이 이름이 들어간 요약, 하이라이트 2개, 열린 질문 3개를 반환한다.

- [ ] **Step 4: GREEN 확인**
  - Run: `node --experimental-strip-types --test src/app/parent/report/report-model.test.mts`
  - Expected: 모든 테스트 통과.

### Task 2: 전체 리포트 화면과 달력 미리보기

**Files:**
- Create: `src/app/parent/report/page.tsx`
- Modify: `src/app/parent/calendar/page.tsx`

**Interfaces:**
- Consumes: `createParentWeeklyReport`, `formatWeekRange`, `getWeekRange`
- Consumes: `store.getOrCreateDemoFamily(getVisitorId())`
- Produces: `/parent/report` 정적 리포트 화면과 `/parent/calendar` 미리보기 링크

- [ ] **Step 1: `/parent/report` 화면 구현**
  - 기존 Parent 색·글꼴·카드 반경을 재사용한다.
  - loading, ready, error 상태를 제공한다.
  - 요약, 하이라이트 2개, 추천 질문 3개, `/parent/ask` 이동을 표시한다.
  - `ParentBottomNav active="record"`를 사용한다.

- [ ] **Step 2: 달력에 미리보기 링크 추가**
  - ready 상태의 달력 월 이동 영역 위에 기간·요약·`주간 리포트 보기`를 담은 링크를 추가한다.
  - 링크 목적지가 `/parent/report`인지 확인한다.

- [ ] **Step 3: UI 파일 형식 검사**
  - Run: `git diff --check -- src/app/parent/calendar/page.tsx src/app/parent/report src/data/parent-report.ts`
  - Expected: 출력 없이 종료 코드 0.

### Task 3: 전체 검증과 전달

**Files:**
- Verify only: 위 작업 파일과 기존 전체 테스트

- [ ] **Step 1: 전체 모델 테스트 실행**
  - 먼저 `rg --files -g '*.test.mts'`로 목록을 확인한 뒤, 그 파일들을 `node --experimental-strip-types --test` 인수로 명시한다.
  - Expected: 실패 0개.

- [ ] **Step 2: lint 실행**
  - Run: `npm run lint`
  - Expected: 종료 코드 0.

- [ ] **Step 3: production build 실행**
  - Run: `npm run build`
  - Expected: `/parent/report`를 포함한 빌드 성공.

- [ ] **Step 4: 수동 확인 경로 전달**
  - `npm run dev` 후 `/parent/calendar`, `/parent/report`, `/demo`를 확인한다.

- [ ] **Step 5: 커밋 준비**
  - Stage only: 설계·계획 문서와 Task 1~2의 파일.
  - Commit message: `feat: 부모 주간 리포트 화면 추가`
