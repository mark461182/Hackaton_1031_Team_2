# Elly 저장 계층 1단계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 화면이 Supabase를 직접 부르지 않도록 `src/lib/store.ts`에 예시 가족·대화·부모 질문·답장 카드·위험 알림·공유 제안 저장 API를 만들고, Supabase 준비 전에는 브라우저 저장소로 동일하게 동작시킨다.

**Architecture:** `store.ts`가 비동기 `EllyStore` 인터페이스를 제공하고, 이번 단계에서는 메모리/브라우저 저장 구현을 사용한다. 방문자별 무작위 ID로 가족 데이터를 분리하고 구독 알림으로 `/demo`의 부모·아이 화면이 같은 상태를 즉시 다시 읽을 수 있게 한다. Supabase 연결은 같은 인터페이스 안에서 교체하며 화면 코드는 바꾸지 않는다.

**Tech Stack:** TypeScript, Node 24 내장 테스트 러너, Web Storage API, Next.js 15

**Spec:** `docs/03_MVP_스펙.md`의 “저장 함수”, `docs/09_역할별_작업.md`의 1장·3장

## Global Constraints

- `src/lib/types.ts`와 `src/app/api/**`, `src/lib/llm/**`, `src/lib/voice/**`는 수정하지 않는다.
- 화면은 이후 `store.ts`만 호출하며 Supabase를 직접 호출하지 않는다.
- 음성 파일은 저장하지 않고 `Message.text`만 저장한다.
- 가족 당 대기 중인 부모 질문은 한 번에 하나만 반환한다.
- 서로 다른 방문자 ID의 데이터는 섞이지 않는다.
- 서비스와 코끼리 이름은 `elly`로 사용하되, 저장 API에는 미정 가격 정보를 넣지 않는다.
- Supabase 브라우저 키는 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 이름만 문서화하고 값은 커밋하지 않는다.

## Review Focus

- 같은 방문자 ID로 다시 열었을 때 같은 가족과 데이터가 반환되어야 한다.
- 다른 방문자 ID는 가족·대화·피드가 완전히 분리되어야 한다.
- 질문을 물음/답함 처리하면 다음 대기 질문이 정확히 선택되어야 한다.
- 답장 카드·위험 알림·수락한 공유만 부모 피드에 최신순으로 보여야 한다.
- 초기화 후 해당 방문자의 데이터만 새 예시 가족 상태로 돌아가야 한다.

---

### Task 1: 메모리 저장 계약과 핵심 동작

**Files:**
- Create: `src/lib/store.test.ts`
- Create: `src/lib/store.ts`

**Interfaces:**
- Produces: `createMemoryStore()`, `getOrCreateDemoFamily(visitorId)`, `resetDemoFamily(visitorId)`, 메시지/질문/답장/알림/공유 저장·조회 함수, `getParentFeed(familyId)`, `subscribe(listener)`

- [ ] **Step 1: 실패하는 테스트 작성** — 방문자 분리, 동일 방문자 재조회, 메시지 저장, 질문 대기/물음/답함, 부모 피드 최신순, 가족별 초기화를 각각 검증한다.
- [ ] **Step 2: RED 확인** — `node --test src/lib/store.test.ts`가 `store.ts` 없음 또는 함수 없음으로 실패하는지 확인한다.
- [ ] **Step 3: 최소 메모리 구현** — `src/lib/types.ts`의 타입을 그대로 사용하고 모든 변경마다 구독자에게 알린다.
- [ ] **Step 4: GREEN 확인** — `node --test src/lib/store.test.ts`가 전부 통과하는지 확인한다.

### Task 2: 브라우저 방문자 저장과 기본 store 내보내기

**Files:**
- Modify: `src/lib/store.test.ts`
- Modify: `src/lib/store.ts`

**Interfaces:**
- Consumes: Task 1의 `EllyStore` 계약
- Produces: 브라우저 `localStorage`에 상태를 유지하는 기본 `store`, `getVisitorId()`, 저장소를 사용할 수 없을 때 메모리로 돌아가는 fallback

- [ ] **Step 1: 실패하는 테스트 작성** — 가짜 Storage를 주입해 새 store 인스턴스가 기존 방문자 상태를 복원하고, Storage 오류 때 메모리 동작을 유지하는지 검증한다.
- [ ] **Step 2: RED 확인** — 새 브라우저 저장 함수가 없어 테스트가 실패하는지 확인한다.
- [ ] **Step 3: 최소 브라우저 구현** — 모듈을 불러오는 순간 `window`에 접근하지 않고 실제 호출 시에만 Storage를 사용한다.
- [ ] **Step 4: GREEN 확인** — 내장 테스트 전체가 통과하는지 확인한다.

### Task 3: Supabase 연결 자리와 전체 검증

**Files:**
- Modify: `.env.example`
- Modify: `src/lib/store.test.ts`
- Modify: `src/lib/store.ts`

**Interfaces:**
- Produces: `getStoreMode()`가 현재 `memory`를 명확히 반환하고, Supabase URL·publishable key가 준비된 뒤 내부 구현만 교체할 수 있는 경계

- [ ] **Step 1: 실패하는 테스트 작성** — Supabase 키가 없는 현재 환경에서 `getStoreMode()`가 `memory`인지 검증한다.
- [ ] **Step 2: RED 확인** — 함수가 없어 테스트가 실패하는지 확인한다.
- [ ] **Step 3: 최소 구현과 환경변수 이름 추가** — `.env.example`에 전달받은 URL 자리와 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`만 추가하고 실제 키는 넣지 않는다.
- [ ] **Step 4: 최종 검증** — `node --test src/lib/store.test.ts`, `npm run lint`, `npm run build`, `git diff --check`를 차례로 실행한다.
