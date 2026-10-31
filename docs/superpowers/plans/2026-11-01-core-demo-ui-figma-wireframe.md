# 코끼리 핵심 데모 Figma 와이어프레임 제작 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 요청된 색상·글꼴·Elly 상태 자산을 적용해 역할 선택, 아이 대화, 부모 피드·질문, 두 폰 데모를 검토할 수 있는 중간 충실도 Figma 리뷰 보드를 만든다.

**Architecture:** 새 독립 Figma 파일을 `00 Foundations`, `01 Components`, `02 Kid Flow`, `03 Parent Flow`, `04 Demo` 다섯 페이지로 나눈다. 390×844 모바일 프레임을 기본 단위로 하고, 상태 차이는 컴포넌트 variant로 만든 뒤 대표 화면에 인스턴스로 배치한다. 첫 산출물은 정적 리뷰 보드이며 화면 간 이동은 화살표와 주석으로 표시한다.

**Tech Stack:** Figma, Figma MCP connector, 저장소의 `src/lib/elly/**` GIF·WebP 자산

**Spec:** `docs/superpowers/specs/2026-11-01-core-demo-ui-wireframe-design.md`

## Global Constraints

- 저장소 역할은 `성준·재모`이며 화면·컴포넌트·디자인 적용 범위만 다룬다.
- 제품 코드는 수정하지 않고 Figma 산출물과 이 계획 문서만 만든다.
- 아이 화면에 부모 질문 또는 부모 전달 사실을 노출하지 않는다.
- 음성이 기본이며 글자 입력과 선택지는 항상 대체 수단으로 남긴다.
- 모든 모바일 화면은 390×844, 좌우 여백 20px, 최소 터치 대상 44×44px을 기준으로 한다.
- 배경 `#F7F4EC`, 브랜드 `#728F7A`, 보조 배경 `#DCE8D8`, 감정 포인트 `#E9B89A`, 기본 텍스트 `#383D37`, 주요 버튼 `#4F6F59`를 사용한다.
- 본문은 `Pretendard`, 제목·주요 버튼·아이 친화 문구는 `NanumSquareRound`를 사용한다.
- Elly는 `src/lib/elly/**`의 기존 자산만 사용하며 모션 감소 대체로 같은 이름의 WebP를 둔다.
- 그라디언트, 유리 효과, 고정 카드 그림자, 장식용 아이콘, 가로 스크롤 선택지 칩을 사용하지 않는다.

## Review Focus

- 390×844 첫 화면에서 캐릭터, 최신 문장, 음성 버튼이 서로 밀어내지 않고 함께 보여야 한다.
- 듣기·생각·말하기 상태가 색만이 아니라 이미지와 문구로도 구분돼야 한다.
- 부모 피드의 위험 알림이 다른 카드보다 우선적으로 읽히되 과도하게 자극적이지 않아야 한다.
- 글자 입력, 선택지, 오류 복구 상태에서도 음성 중심 구조와 44px 터치 기준이 무너지지 않아야 한다.
- `/demo`의 두 폰이 같은 가족 흐름으로 읽히고 768px 이하 탭 전환 구조가 별도로 설명돼야 한다.

---

### Task 1: Figma 파일과 Foundations

**Files:**
- Create: 새 Figma 파일 `코끼리 핵심 데모 UI`
- Create page: `00 Foundations`

**Interfaces:**
- Consumes: 승인된 설계 문서의 색상·글꼴·간격·라운드 값
- Produces: 이후 모든 컴포넌트가 참조하는 colour styles, text styles, spacing notes

- [ ] **Step 1: Figma 연결과 새 파일 생성 확인**

Figma 연결 상태가 `connected`인지 확인하고 새 파일 `코끼리 핵심 데모 UI`를 만든다. 기존 파일을 덮어쓰지 않는다.

- [ ] **Step 2: 페이지 구조 생성**

`00 Foundations`, `01 Components`, `02 Kid Flow`, `03 Parent Flow`, `04 Demo` 페이지를 이 순서로 만든다.

- [ ] **Step 3: 색상 스타일 생성**

`Color/Background/Warm Ivory #F7F4EC`, `Color/Brand/Muted Sage #728F7A`, `Color/Action/Deep Sage #4F6F59`, `Color/Surface/Light Sage #DCE8D8`, `Color/Emotion/Soft Peach #E9B89A`, `Color/Text/Charcoal #383D37`, `Color/Surface/White #FFFFFF` 스타일을 만든다. 위험·오류용 빨강은 일반 텍스트 4.5:1 대비를 만족하는 한 쌍으로 만들고 `Color/Semantic/Danger/*`로 이름 붙인다.

- [ ] **Step 4: 텍스트 스타일 생성**

`Text/Title/28`, `Text/Screen/24`, `Text/Section/18`, `Text/Body/16`, `Text/Body Strong/16`, `Text/Meta/13`, `Text/Button/17`을 만든다. 제목과 버튼은 NanumSquareRound, 본문과 메타는 Pretendard를 사용한다.

- [ ] **Step 5: 형태 규칙 기록**

20px 모바일 여백, 16·24px 주요 간격, 카드 20px, 패널·입력·버튼 16px, 주요 버튼 52px, 음성 버튼 64px을 `00 Foundations`에 실제 크기 샘플과 함께 둔다.

- [ ] **Step 6: Foundations 검증**

색상 hex, 스타일 이름, 글꼴 역할, 터치 높이를 설계 문서와 대조한다. 배경 위 Charcoal 본문이 10.10:1, Deep Sage 위 흰 버튼 라벨이 5.60:1인지 표시한다.

- [ ] **Step 7: 체크포인트 기록**

Figma 버전 설명을 `Foundations complete`로 남기고 `00 Foundations` 전체 프레임을 이미지로 확인한다.

### Task 2: 공용 컴포넌트와 상태 variant

**Files:**
- Create page content: `01 Components`

**Interfaces:**
- Consumes: Task 1 colour styles, text styles, spacing rules
- Produces: `Button`, `TopBar`, `EllyStage`, `HoldToTalk`, `TranscriptConfirm`, `ChoiceButtons`, `FeedCard`, `RiskAlertCard`, `QuestionComparison`, `BottomNav`, `DemoPhoneFrame`

- [ ] **Step 1: 버튼 세트 생성**

`Button` 컴포넌트에 `Type=Primary|Secondary|Text`, `State=Default|Pressed|Disabled`, `Width=Fill|Hug` 속성을 만든다. Primary는 Deep Sage `#4F6F59`와 흰 글자, Secondary는 Light Sage, Text는 배경 위 Charcoal로 구성한다.

- [ ] **Step 2: 상단 바와 부모 하단 내비게이션 생성**

`TopBar`는 48px 높이, 뒤로가기·화면 제목·한 개 보조 행동 슬롯을 가진다. `BottomNav`는 `Active=Home|Ask|Record|More` 네 variant와 44px 이상 항목을 가진다.

- [ ] **Step 3: EllyStage 생성**

`EllyStage`에 `State=Greeting|Listening|Thinking|Speaking|Empathy|ReducedMotion` variant를 만든다. 각각 greet GIF, listen GIF, think GIF, excited GIF, cry GIF, 동일 상태 WebP를 사용하고 상태 문구·최신 Elly 문장 슬롯을 둔다.

- [ ] **Step 4: 음성·받아쓰기 컴포넌트 생성**

`HoldToTalk`에 `State=Ready|Listening|Disabled`를 만들고 높이 64px을 유지한다. `TranscriptConfirm`에는 받아쓴 문장, `맞아`, `다시 말하기`를 두고 두 행동 모두 44px 이상으로 만든다.

- [ ] **Step 5: 글자 입력·선택지·지난 이야기 variant 생성**

`TextInputPanel`에 `State=Collapsed|Expanded|Error`를 만들고, `ChoiceButtons`는 1열과 2열만 허용한다. `TranscriptSheet`는 이전 대화가 있는 상태와 빈 상태를 갖는 바텀시트로 만든다.

- [ ] **Step 6: 부모 카드 컴포넌트 생성**

`FeedCard`에 `Type=Reply|Shared`, `State=Default|Unread|Loading|Error|Empty`를 만든다. `RiskAlertCard`는 아이 말 원문, 상황 요약, 대화 가이드 세 영역을 한 카드에 포함하고 Danger 스타일은 작은 표면과 제목에만 쓴다.

- [ ] **Step 7: 질문 비교와 데모 프레임 생성**

`QuestionComparison`에 `State=Editing|Rewritten|Pending`를 만든다. `DemoPhoneFrame`은 390×844 콘텐츠 슬롯과 외부 라벨을 가지며 실제 모바일 화면 내부에는 라벨이 들어가지 않게 한다.

- [ ] **Step 8: 컴포넌트 검증**

모든 인터랙티브 variant의 높이를 재고 44px 미만이 없는지 확인한다. 상태를 흑백으로 보아도 문구와 자산 차이로 구분되는지 확인한다.

- [ ] **Step 9: 체크포인트 기록**

Figma 버전 설명을 `Components complete`로 남기고 모든 variant가 한 화면에 보이는 컴포넌트 인덱스를 확인한다.

### Task 3: 역할 선택과 Kid Flow

**Files:**
- Create page content: `02 Kid Flow`

**Interfaces:**
- Consumes: Task 2 `TopBar`, `EllyStage`, `HoldToTalk`, `TranscriptConfirm`, `TextInputPanel`, `ChoiceButtons`, `TranscriptSheet`
- Produces: `Home/Role Select`, `Kid/Greeting`, `Kid/Listening`, `Kid/Transcript Confirm`, `Kid/Thinking`, `Kid/Speaking` 화면

- [ ] **Step 1: 역할 선택 화면 구성**

390×844 `Home/Role Select` 프레임에 서비스 이름, 한 문장 설명, greet WebP, `아이로 시작하기`, `부모로 시작하기`, `예시 가족으로 체험하기`를 배치한다. 예시 가족 행동은 `/demo`로 이어진다는 주석을 단다.

- [ ] **Step 2: 시작 전 화면 구성**

`Kid/Greeting`에 TopBar, greet EllyStage, `이야기 시작` 한 개의 하단 주요 버튼을 배치한다.

- [ ] **Step 3: 듣기와 받아쓰기 확인 화면 구성**

`Kid/Listening`에는 listen EllyStage, 실시간 받아쓰기, Listening HoldToTalk을 배치한다. `Kid/Transcript Confirm`에는 받아쓰기 확인 카드와 `맞아`·`다시 말하기`, 접힌 글자 입력을 배치한다.

- [ ] **Step 4: 생각과 말하기 화면 구성**

`Kid/Thinking`에는 think EllyStage와 비활성 입력을, `Kid/Speaking`에는 excited EllyStage, 최신 Elly 답, 선택지 버튼, Ready HoldToTalk을 배치한다.

- [ ] **Step 5: 보조 상태 배치**

대표 화면 옆에 `TextInputPanel/Expanded`, `TextInputPanel/Error`, `TranscriptSheet/History`, `ChoiceButtons/TwoColumn`, `EllyStage/Empathy` variant를 실제 크기로 둔다.

- [ ] **Step 6: 흐름 표시**

`Home/Role Select → Kid/Greeting → Listening → Transcript Confirm → Thinking → Speaking` 순서로 화살표와 상태 전환 조건을 단다. 아이 화면 어느 곳에도 부모 전달 표현이 없는지 문구를 검색한다.

- [ ] **Step 7: Kid Flow 검증**

각 390×844 프레임에서 캐릭터, 최신 문장, 음성 버튼이 첫 화면 안에 보이는지 확인한다. 모든 프레임의 좌우 여백이 20px이고 가로 넘침이 없는지 확인한다.

- [ ] **Step 8: 체크포인트 기록**

Figma 버전 설명을 `Kid flow complete`로 남기고 100%와 50% 확대에서 전체 흐름을 확인한다.

### Task 4: Parent Flow

**Files:**
- Create page content: `03 Parent Flow`

**Interfaces:**
- Consumes: Task 2 `TopBar`, `BottomNav`, `FeedCard`, `RiskAlertCard`, `QuestionComparison`, `Button`
- Produces: `Parent/Home`, `Parent/Ask Editing`, `Parent/Ask Rewritten`, 부모 피드·질문 상태 variants

- [ ] **Step 1: 부모 홈 구성**

`Parent/Home`에 `준우네에 새 소식이 있어요`, 새 항목 수, `아이에게 질문 맡기기`, 위험 알림, 답장 카드, 공유 카드, BottomNav를 우선순위 순으로 배치한다.

- [ ] **Step 2: 위험 알림 정보 계층 검증**

아이 말 원문이 가장 먼저 읽히고, 상황 요약과 대화 가이드가 그 뒤를 잇게 한다. Danger 색이 카드 전체를 채우지 않고 제목·작은 표면에만 쓰이는지 확인한다.

- [ ] **Step 3: 질문 입력 화면 구성**

`Parent/Ask Editing`에 원래 질문 입력과 `Elly에게 다듬어 달라고 하기` 행동을 배치한다. `Parent/Ask Rewritten`에는 `내 질문`, `Elly가 물어볼 말`, `이 질문 맡기기`를 세로 비교한다.

- [ ] **Step 4: 부모 상태 variant 배치**

대표 화면 옆에 `QuestionComparison/Pending`, `FeedCard/Empty`, `FeedCard/Loading`, `FeedCard/Error`를 실제 크기로 둔다.

- [ ] **Step 5: 흐름 표시**

`Parent/Home → Ask Editing → Ask Rewritten → Pending → Parent/Home` 흐름을 화살표로 표시하고 대기 질문은 한 번에 하나라는 주석을 단다.

- [ ] **Step 6: Parent Flow 검증**

첫 화면에서 새 소식과 질문 맡기기 행동이 보이고, 위험 → 답장 → 공유 순서가 유지되는지 확인한다. 부모 카드 문구에 진단·판정 표현이 없는지 검색한다.

- [ ] **Step 7: 체크포인트 기록**

Figma 버전 설명을 `Parent flow complete`로 남기고 390×844 프레임을 이미지로 확인한다.

### Task 5: Demo 보드와 최종 검토

**Files:**
- Create page content: `04 Demo`

**Interfaces:**
- Consumes: Task 3 Kid frames, Task 4 Parent frames, Task 2 `DemoPhoneFrame`
- Produces: 데스크톱 두 폰 데모, 768px 이하 탭 구조 설명, 최종 리뷰 링크

- [ ] **Step 1: 데스크톱 두 폰 보드 구성**

Warm Ivory 보드 위에 `부모 화면`과 `아이 화면` DemoPhoneFrame을 24px 간격으로 배치하고 같은 `준우네` 예시 가족을 사용한다.

- [ ] **Step 2: 핵심 데모 순간 배치**

부모 질문 대기, 아이가 답하는 순간, 부모 답장 카드 생성, 위험 알림 생성의 네 장면을 가로 순서로 구성한다. 각 장면은 부모·아이 화면 한 쌍으로 만든다.

- [ ] **Step 3: 태블릿 이하 구조 표시**

768px 이하에서는 `부모 | 아이` 탭으로 한 화면만 보인다는 반응형 주석과 390px 예시 프레임을 둔다.

- [ ] **Step 4: 전체 디자인 검사**

모든 프레임에서 지정 색상과 두 글꼴 외의 임의 스타일이 없는지, 카드 그림자·그라디언트·가로 칩이 없는지 확인한다. 동일 역할 컴포넌트가 인스턴스로 연결돼 있는지 확인한다.

- [ ] **Step 5: 전체 내용 검사**

역할 선택 → 아이 대화 → 부모 질문·피드 → 두 폰 데모가 보드만 읽어도 이해되는지 확인한다. 아이 화면의 부모 관련 금지 문구와 부모 화면의 진단·판정 표현을 다시 검색한다.

- [ ] **Step 6: 최종 화면 검토**

`00`부터 `04`까지 각 페이지를 100% 확대에서 열고, 주요 모바일 프레임을 390×844 이미지로 확인한다. 가장 눈에 띄는 문제 세 가지를 고쳐 한 차례만 다시 검토한다.

- [ ] **Step 7: 최종 버전과 링크 기록**

Figma 버전 설명을 `Core demo wireframe v1`로 남기고 편집 가능한 Figma 링크와 검토 순서를 사용자에게 전달한다.
