# Elly 아이 대화 화면 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/kid`에서 아이가 글자 또는 꾹 누르고 말하기로 기존 가짜 API와 대화하고, 응답을 `store.ts`에 저장하며 elly의 답을 소리로 듣게 한다.

**Architecture:** API 요청·응답 변환은 `src/app/kid/chat-model.ts`의 순수 함수로 분리해 Node 내장 테스트로 검증한다. `page.tsx`는 클라이언트 화면으로서 기존 `store`, `/api/kid/chat`, `src/lib/voice`만 연결한다. 코끼리 대사는 건준의 고정 대사와 API 응답만 사용한다.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Node 24 test runner

**Spec:** `docs/03_MVP_스펙.md`의 “화면”·“핵심 흐름”·“데모 체크”, `docs/09_역할별_작업.md` 3장 2번

## Global Constraints

- `src/app/api/**`, `src/lib/llm/**`, `src/lib/voice/**`, `src/lib/types.ts`는 수정하지 않는다.
- 화면은 저장할 때 `src/lib/store.ts`만 호출한다.
- 코끼리 말투와 대사는 만들지 않고 `FIXED_LINES`와 `/api/kid/chat` 응답만 표시한다.
- 아이 화면에 부모에게 전달된다는 문구를 넣지 않는다.
- 녹음 파일은 만들거나 저장하지 않고 받아쓴 글자만 저장한다.
- 글자 입력은 음성 미지원 환경에서도 항상 사용할 수 있어야 한다.
- 도하 디자인 전이므로 공용 색·컴포넌트 체계를 새로 정하지 않고 단순하게 만든다.

## Review Focus

- API 오류 후에도 입력창이 다시 활성화되어야 한다.
- STT가 없거나 결과가 비어도 글자 입력으로 대화할 수 있어야 한다.
- 같은 메시지를 전송 중 여러 번 저장하거나 중복 전송하지 않아야 한다.
- 질문 asked/answered 신호와 답장·알림·공유 제안이 store에 정확히 저장되어야 한다.
- 위험 응답에서도 아이 화면에는 부모 알림 여부가 노출되지 않아야 한다.

---

### Task 1: 대화 요청·응답 모델

**Files:**
- Create: `src/app/kid/chat-model.ts`
- Create: `src/app/kid/chat-model.test.mts`

**Interfaces:**
- Produces: `buildPendingQuestion(question, messages)`, `buildKidChatRequest(...)`, `createChatRecords(...)`

- [ ] 실패 테스트: 최근 대화 10턴, 대기 질문 횟수, 분류가 붙은 아이 메시지, 코끼리 메시지와 reply/alert/share 저장 레코드를 검증한다.
- [ ] `node --test src/app/kid/chat-model.test.mts`로 RED를 확인한다.
- [ ] 최소 순수 함수 구현 후 GREEN을 확인한다.

### Task 2: `/kid` 모바일 대화 화면

**Files:**
- Modify: `src/app/kid/page.tsx`

**Interfaces:**
- Consumes: Task 1 모델, `store`, `/api/kid/chat`, `createPushToTalk`, `pickTranscript`, `speak`, `speakFiller`, `FIXED_LINES`
- Produces: 시작 버튼, 대화 목록, 생각 중 상태, 선택지, 글자 입력, 받아쓴 글자 확인, 꾹 누르고 말하기

- [ ] 빈 대화에서 시작 버튼을 누르면 건준의 고정 인사말을 저장·재생한다.
- [ ] 글자 또는 확인한 받아쓰기 결과를 API에 한 번 전송한다.
- [ ] API 응답과 부가 레코드를 store에 저장하고 elly 답을 읽는다.
- [ ] 음성 미지원·API 오류 상태를 글자로 안내하며 글자 입력은 유지한다.

### Task 3: 전체 검증

**Files:**
- Verify only

- [ ] `node --test src/lib/store.test.mts src/app/kid/chat-model.test.mts`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `git diff --check`
- [ ] `npm run dev` 후 `http://localhost:3000/kid`에서 시작·글자 대화·선택지·STT 대체 문구를 확인한다.
