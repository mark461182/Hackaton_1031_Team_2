# 코끼리 핵심 데모 UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 리뷰 보드의 색상·글꼴·Elly 상태·모바일 구성을 기존 Next.js 핵심 데모 화면에 적용한다.

**Architecture:** 기존 store/API/음성 상태 로직은 유지하고, 전역 디자인 토큰과 작은 공용 UI 컴포넌트를 추가해 `/`, `/kid`, `/parent`, `/parent/ask`, `/demo`가 같은 시각 언어를 공유하게 한다. 상태별 Elly 표현과 부모 질문 변환은 순수 모델 함수로 검증하고 페이지는 해당 결과를 렌더링한다.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 4, Node test runner

**Spec:** `docs/superpowers/specs/2026-11-01-core-demo-ui-wireframe-design.md`

## Global Constraints

- 성준·재모 담당 경로만 수정하고 `src/app/api/**`, `src/lib/llm/**`, `src/lib/voice/**`, `src/lib/types.ts`는 수정하지 않는다.
- 기존 음성·대화·저장 동작과 경로를 유지한다.
- 아이 화면에는 부모 질문의 출처나 부모에게 전달된다는 표현을 넣지 않는다.
- 배경 `#F7F4EC`, 브랜드 `#728F7A`, 보조 `#DCE8D8`, 감정 `#E9B89A`, 텍스트 `#383D37`, 주요 행동 `#4F6F59`를 사용한다.
- 제목·아이 문구·주요 버튼은 NanumSquareRound, 본문·입력·부모 정보는 Pretendard를 사용한다.
- Elly 상태 이미지는 `src/lib/elly/**`만 사용하고 모션 감소에서는 WebP로 대체한다.
- 390px에서 가로 넘침이 없고 모든 행동 영역은 최소 44px이다.
- 사용자 변경이 섞인 현재 브랜치에서는 커밋하지 않고 수정·검증 결과만 전달한다.

## Review Focus

- 마이크 미지원·API 오류에서도 글자 입력과 재시도 행동이 화면 안에 남는다.
- 듣기·생각·말하기 상태가 이미지·문구·버튼 라벨로 함께 구분된다.
- 부모 피드는 위험 → 답장 → 공유 순서와 원문·요약·가이드 구조를 유지한다.
- 부모 질문이 이미 대기 중이면 새 질문을 덮어쓰지 않는다.
- `/demo`는 데스크톱 두 폰과 모바일 부모·아이 탭 모두에서 같은 visitor 저장소를 본다.

---

### Task 1: 전역 디자인 토큰과 공용 Elly 컴포넌트

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Create: `src/components/elly-stage.tsx`
- Modify: `src/app/kid/chat-model.test.mts`
- Modify: `src/app/kid/chat-model.ts`

**Interfaces:**
- Produces: `KidScreenState`, `getKidStagePresentation(state, started)`, `EllyStage`
- Consumes: `src/lib/elly/elephant_{greet,listen,think,excited,cry}.{gif,webp}`

- [ ] **Step 1: 상태별 Elly 표현 테스트를 추가하고 실패를 확인한다**
- [ ] **Step 2: `getKidStagePresentation`을 최소 구현하고 테스트 통과를 확인한다**
- [ ] **Step 3: 전역 토큰·폰트·포커스·모션 감소 스타일을 추가한다**
- [ ] **Step 4: GIF/WebP를 상태에 맞게 보여 주는 `EllyStage`를 만든다**
- [ ] **Step 5: 모델 테스트와 lint를 실행한다**

### Task 2: 역할 선택과 아이 대화 화면

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/kid/page.tsx`
- Test: `src/app/home-model.test.mts`
- Test: `src/app/kid/chat-model.test.mts`

**Interfaces:**
- Consumes: Task 1 `EllyStage`, `getKidStagePresentation`
- Produces: 리뷰 보드와 일치하는 역할 선택 및 아이 Greeting/Listening/Confirm/Thinking/Speaking 화면

- [ ] **Step 1: 기존 홈·아이 모델 테스트를 실행해 동작 기준을 고정한다**
- [ ] **Step 2: 역할 선택을 실제 greet 자산과 세로 행동 구조로 바꾼다**
- [ ] **Step 3: 아이 화면을 캐릭터 스테이지·최신 대화·받아쓰기 확인·2열 선택지·64px 음성 행동으로 재구성한다**
- [ ] **Step 4: 마이크 미지원·오류·키보드 대체 상태를 확인한다**
- [ ] **Step 5: 모델 테스트와 lint를 실행한다**

### Task 3: 부모 홈과 질문 맡기기

**Files:**
- Modify: `src/components/parent-feed.tsx`
- Modify: `src/app/parent/page.tsx`
- Create: `src/app/parent/ask/ask-model.ts`
- Create: `src/app/parent/ask/ask-model.test.mts`
- Create: `src/app/parent/ask/page.tsx`

**Interfaces:**
- Produces: `parseParentAskResponse(value)`, `createQuestionFromAsk(familyId, response, now, nextId)`
- Consumes: `POST /api/parent/ask`, `store.getPendingQuestion`, `store.saveQuestion`

- [ ] **Step 1: 질문 응답 검증·Question 생성 테스트를 작성하고 실패를 확인한다**
- [ ] **Step 2: ask 모델을 최소 구현하고 테스트 통과를 확인한다**
- [ ] **Step 3: 부모 피드의 카드 계층과 상태 화면을 리뷰 보드에 맞춘다**
- [ ] **Step 4: 질문 입력·변환 비교·대기 상태 페이지를 구현한다**
- [ ] **Step 5: 부모 모델 테스트와 lint를 실행한다**

### Task 4: 두 폰 데모와 최종 시각 검수

**Files:**
- Modify: `src/app/demo/demo-model.test.mts`
- Modify: `src/app/demo/demo-model.ts`
- Modify: `src/app/demo/page.tsx`

**Interfaces:**
- Produces: `DemoPanelId`, `getVisibleDemoPanels(mode, activeId)`
- Consumes: `/parent`, `/kid`, 동일 visitor 저장소

- [ ] **Step 1: 모바일 활성 탭 패널 모델 테스트를 추가하고 실패를 확인한다**
- [ ] **Step 2: 데모 패널 모델을 최소 구현하고 테스트 통과를 확인한다**
- [ ] **Step 3: 데스크톱 두 폰·모바일 탭 구조를 구현한다**
- [ ] **Step 4: 전체 모델 테스트·lint·production build를 실행한다**
- [ ] **Step 5: production 화면을 1440·768·390px로 검사하고 스크린샷의 상위 문제를 보정한다**
