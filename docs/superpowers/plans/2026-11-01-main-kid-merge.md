# Main Kid Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 원격 `main`의 실제 LLM·즉시 음성 전송 변경과 성준·재모의 저장·코인·공유·3줄 일기·달력 화면을 기능 손실 없이 합친다.

**Architecture:** `src/app/kid/page.tsx`는 store 연동과 완성된 화면을 가진 성준·재모 구현을 기준으로 충돌을 해결한다. 원격 API·LLM 파일은 병합 결과를 그대로 유지하고, 음성 인식 결과만 확인 카드 없이 기존 `sendMessage`로 바로 전달한다.

**Tech Stack:** Next.js App Router, React, TypeScript, Node test runner

**Spec:** `docs/03_MVP_스펙.md`, 사용자 승인(기존 완성 화면 + 즉시 음성 전송 + 실제 LLM API)

## Global Constraints

- `src/app/api/**`, `src/lib/llm/**`, `src/lib/voice/**`, `src/lib/types.ts`의 원격 변경을 수정하지 않는다.
- 화면 저장은 `store.ts` 함수만 사용한다.
- 아이 화면에 부모 전달 문구를 추가하지 않는다.

## Review Focus

- 음성 인식 성공 시 확인 카드 없이 정확히 한 번 전송되어야 한다.
- 음성 인식 실패 시 빈 메시지를 전송하지 않아야 한다.
- 원격 실제 LLM API 변경과 기존 store 요청 형식이 함께 빌드되어야 한다.
- 코인·공유·3줄 일기·달력 연결이 병합 뒤에도 남아야 한다.
- 병합 결과 전체 테스트와 배포 빌드가 통과해야 한다.

### Task 1: 아이 화면 충돌 해결과 즉시 음성 전송

**Files:**
- Modify: `src/app/kid/page.tsx`
- Modify: `src/app/kid/chat-model.ts`
- Test: `src/app/kid/chat-model.test.mts`

**Interfaces:**
- Produces: `getKidVoiceSendIntent(transcript: string): { text: string; confirmed: true } | undefined`
- Consumes: 기존 `sendMessage(text, confirmed)`와 원격 `/api/kid/chat`

- [x] **Step 1: 음성 문장을 즉시 전송 의도로 바꾸고 빈 문장은 거부하는 실패 테스트 작성**
- [x] **Step 2: 테스트를 실행해 함수 부재로 실패 확인**
- [x] **Step 3: 최소 모델 함수 구현 후 `endTalk`이 확인 상태 대신 즉시 `sendMessage`를 호출하도록 연결**
- [x] **Step 4: 모델 테스트 통과 확인**
- [x] **Step 5: 충돌 해결 파일과 계획 문서를 스테이징해 병합 커밋 생성**

### Task 2: 병합 결과 검증과 main 푸시

**Files:**
- Verify: 전체 병합 트리

- [x] **Step 1: 전체 Node 테스트 실행**
- [x] **Step 2: `npm run lint` 실행**
- [x] **Step 3: `npm run build` 실행**
- [ ] **Step 4: `origin/main`으로 푸시하고 원격 커밋 확인**
