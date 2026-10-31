# 부모 피드 화면 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/parent`에서 같은 예시 가족의 답장 카드·위험 알림·동의한 공유 이야기를 모바일 피드로 보고, 아이 화면에서 새 기록이 저장되면 자동으로 갱신한다.

**Architecture:** `src/app/parent/feed-model.ts`가 `store.ts`의 피드와 질문을 화면용 데이터로 결합하고 위험 → 답장 → 공유 우선순위로 정렬한다. `page.tsx`는 방문자 가족을 불러오고 store 변경을 구독하며, `src/components/parent-feed.tsx`가 로딩·빈 상태·오류·세 가지 피드 카드를 렌더링한다. Supabase나 API를 직접 호출하지 않는다.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Node 24 test runner

**Spec:** `docs/superpowers/specs/2026-11-01-core-demo-ui-wireframe-design.md`의 “부모 홈 `/parent`”, `docs/03_MVP_스펙.md`의 “화면”·“핵심 흐름”·“저장 함수”·“데모 체크”

## Global Constraints

- `src/app/api/**`, `src/lib/llm/**`, `src/lib/voice/**`, `src/lib/types.ts`는 수정하지 않는다.
- 화면은 `src/lib/store.ts`만 호출하고 Supabase를 직접 부르지 않는다.
- 위험 알림은 아이 원문·상황 요약·대화 가이드를 모두 보여 준다.
- 답장 카드는 부모 질문·아이 답 원문·요약·메모를 보여 준다.
- 공유 피드에는 `accepted` 상태만 보인다.
- 서비스 이름과 가격은 새로 정하지 않는다.
- 390px 모바일 폭과 `/demo` 안의 한 칸 폭에서 가로 스크롤 없이 동작한다.
- 기존 더러운 작업 트리의 `kid`, 첫 화면, 레이아웃 변경은 건드리지 않는다.

## Review Focus

- 피드가 비어도 질문 맡기기 행동과 빈 상태가 보여야 한다.
- 질문 레코드를 찾지 못한 답장도 화면 전체 오류 없이 표시되어야 한다.
- store 구독 알림이 오면 최신 피드와 질문을 함께 다시 읽어야 한다.
- 불러오기 실패 후 재시도로 복구할 수 있어야 한다.
- 위험·답장·공유 카드의 긴 한국어 문장이 390px에서 넘치지 않아야 한다.

---

### Task 1: 부모 피드 화면 모델

**Files:**
- Create: `src/app/parent/feed-model.ts`
- Create: `src/app/parent/feed-model.test.mts`

**Interfaces:**
- Consumes: `ParentFeedItem[]`, `Question[]`
- Produces: `buildParentFeedEntries(feed, questions): ParentFeedEntry[]`, `formatFeedTime(createdAt): string`

- [ ] 질문과 답장을 결합하고 위험 → 답장 → 공유 순서와 같은 종류 최신순을 검증하는 실패 테스트를 쓴다.
- [ ] 질문이 없는 답장과 잘못된 날짜가 안전한 대체 문구를 쓰는 실패 테스트를 쓴다.
- [ ] `node --test src/app/parent/feed-model.test.mts`로 RED를 확인한다.
- [ ] 최소 순수 함수를 구현하고 같은 명령으로 GREEN을 확인한다.

### Task 2: 부모 피드 카드와 `/parent` 연결

**Files:**
- Create: `src/components/parent-feed.tsx`
- Modify: `src/app/parent/page.tsx`

**Interfaces:**
- Consumes: Task 1 화면 모델, `store.getOrCreateDemoFamily`, `store.getParentFeed`, `store.getQuestions`, `store.subscribe`
- Produces: 모바일 부모 홈, 질문 맡기기 링크, 로딩·빈 상태·오류·재시도, 답장·위험·공유 카드

- [ ] 피드 데이터 로더의 성공·실패·재호출 상태를 검증하는 실패 테스트를 추가한다.
- [ ] store만 사용해 가족·피드·질문을 불러오고 변경 구독 시 다시 읽는다.
- [ ] 카드 컴포넌트와 모바일 레이아웃을 구현한다.
- [ ] 키보드 포커스, 44px 터치 대상, 긴 문장 줄바꿈을 확인한다.

### Task 3: 전체 검증

**Files:**
- Verify only

- [ ] `node --test src/lib/store.test.mts src/app/parent/feed-model.test.mts`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] `npm run dev` 후 `http://localhost:3000/parent`를 390px와 데스크톱에서 확인한다.
