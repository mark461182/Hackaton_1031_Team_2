// 팀 공통 약속 — 저장 데이터(store.ts)와 API 요청·응답의 모양 (docs/09 1장 1번)
// 기준: docs/03 "데이터 구조"·"API"·"핵심 흐름"·"분류 기준". 바꿀 땐 팀 채널에 먼저 알린다.
// 서버 API는 저장하지 않는다: 필요한 맥락은 요청에 담아 받고, 결과를 돌려주면 화면이 store.ts로 저장한다.

export type Id = string;
/** ISO 시각 문자열 (new Date().toISOString()) */
export type IsoTime = string;
/** 날짜 "YYYY-MM-DD" */
export type IsoDate = string;

// ───────────────────────── 분류 ─────────────────────────

/** daily = 일상 · share = 부모가 알면 도움이 될 고민 · risk = 위험 신호 (애매하면 share) */
export type Category = "daily" | "share" | "risk";

/** 위험의 종류 (category가 risk일 때) */
export type RiskType = "bullying" | "violence" | "self_harm" | "adult_contact" | "stranger" | "neglect" | "other";

/** 이야기에 관련된 사람. family면 부모 알림을 만들지 않는다 (docs/03 분류 기준) */
export type Involved = "none" | "friend" | "teacher" | "family" | "stranger" | "other";

/** 부모 쪽(답장 카드·일기·리포트·스토리북)에서 뺄 이유 */
export type KeepFromParentReason = "dont_tell" | "share_declined";

// ───────────────────────── 저장 데이터 (store.ts) ─────────────────────────

export type Family = {
  id: Id;
  name: string; // 예: "준우네"
  kidName: string;
  /** 아이가 모은 코인 (쌓이는 점수) */
  coins: number;
  /** 부모가 충전한 금액 — 아이 코인과 따로 둔다 */
  chargedWon: number;
};

export type Message = {
  id: Id;
  familyId: Id;
  from: "kid" | "kokkiri";
  text: string; // 아이 말은 받아쓴 글자 그대로 (녹음 파일은 저장하지 않는다)
  createdAt: IsoTime;
  /** 아이 메시지에만: API가 준 분류 */
  category?: Category;
  involved?: Involved;
  /** 이 메시지가 어떤 부모 질문과 관련 있는지 (코끼리가 물었거나, 아이가 답했거나) */
  questionId?: Id;
  /** 부모 쪽에 쓰지 않는 내용 ("말하지 마", 공유 [싫어]). 위험이면 위험 규칙이 우선 */
  keepFromParent?: KeepFromParentReason;
  /** 아이가 받아쓴 글자를 [맞아]로 확인했는지 */
  confirmed?: boolean;
  /** 선택지 버튼을 눌러 보낸 말 (아이 자기 말이 아니라 3줄 일기에는 넣지 않는다) */
  viaChoice?: boolean;
};

export type Share = {
  id: Id;
  familyId: Id;
  messageId: Id;
  summary: string; // 부모에게 보낼 내용 (아이가 [좋아]했을 때만 감)
  status: "proposed" | "accepted" | "declined";
  createdAt: IsoTime;
};

export type Alert = {
  id: Id;
  familyId: Id;
  /** 아이 말 원문 1~2문장 */
  quote: string;
  /** 상황 요약 (단정·진단 X) */
  situation: string;
  /** 부모 대화 가이드 */
  guide: string;
  riskType: RiskType;
  createdAt: IsoTime;
  readAt?: IsoTime;
};

export type Question = {
  id: Id;
  familyId: Id;
  /** 부모가 쓴 원래 질문 */
  original: string;
  /** 코끼리가 아이용으로 다듬은 질문 */
  rewritten: string;
  /** 부모에게 보여 줄 "왜 이렇게 바꿨는지" */
  whyChanged?: string;
  createdAt: IsoTime;
  /** 코끼리가 실제로 물은 때 */
  askedAt?: IsoTime;
  /** 아이가 답해서 답장 카드(또는 위험 알림)가 나간 때 */
  answeredAt?: IsoTime;
};

/** 답장 카드: 부모 질문에 대한 아이 답 */
export type Reply = {
  id: Id;
  familyId: Id;
  questionId: Id;
  /** 아이 답 원문 ("말하지 마" 내용은 뺀 것) */
  answer: string;
  /** 코끼리 요약 (존댓말 한 문장) */
  summary: string;
  /** 코끼리 메모: 감정·이유 + 저녁에 건넬 말 */
  note: string;
  createdAt: IsoTime;
};

/** 달력 한 칸: 대화 = 파란 점, 사진 = 빨간 점 */
export type Entry = {
  id: Id;
  familyId: Id;
  date: IsoDate;
  type: "chat" | "photo";
  /** chat이면 대화 묶음 id, photo면 사진 주소 */
  ref: string;
  /** 3줄 일기 ("말하지 마"·[싫어] 제외) */
  diary?: string[];
};

export type CoinLog = {
  id: Id;
  familyId: Id;
  reason: "chat_done" | "photo";
  amount: number;
  createdAt: IsoTime;
};

/** 기프티콘 (가짜). fee = 우리 수수료 */
export type Gift = { id: Id; name: string; price: number; fee: number };

/** 주간 리포트 (정적 화면) */
export type Report = { id: Id; familyId: Id; week: IsoDate; summary: string; nextQuestions: string[] };

// ───────────────────────── API: POST /api/kid/chat ─────────────────────────

/** 대화 기록 한 줄 (API에 맥락으로 넘김) */
export type ChatTurn = { from: "kid" | "kokkiri"; text: string };

export type KidChatRequest = {
  familyId: Id;
  kidName?: string;
  /** 방금 아이가 한 말 (받아쓰기 결과) */
  kidText: string;
  /** 최근 대화 (오래된 것부터, 10턴 정도) */
  history: ChatTurn[];
  /** 대기 중인 부모 질문 (한 번에 하나). 없으면 null */
  pendingQuestion: PendingQuestion | null;
};

export type PendingQuestion = {
  id: Id;
  rewritten: string;
  /** 이미 물었으면 그 시각 */
  askedAt?: IsoTime;
  /** 대기를 시작한 뒤 아이가 말한 횟수 — 서버가 몇 턴 안에 꼭 묻게 하는 데 쓴다 */
  kidTurnsWaiting: number;
};

export type KidChatResponse = {
  /** 코끼리가 아이에게 할 말 (1~2문장, 소리로 읽힘) */
  reply: string;
  /** 아이가 누를 수 있는 짧은 답 0~3개 */
  choices: string[];
  /** 방금 아이 말의 분류 */
  category: Category;
  involved: Involved;
  riskType?: RiskType;
  /** 아이가 "말하지 마"라고 했으면 dont_tell → 화면은 그 메시지를 keepFromParent로 저장 */
  keepFromParent?: KeepFromParentReason;
  /** 이번 reply에서 코끼리가 대기 질문을 물었으면 그 id → 화면은 Question.askedAt을 저장 */
  askedQuestionId?: Id;
  /** 아이가 대기 질문에 답했으면 그 id → 화면은 Question.answeredAt을 저장 */
  answeredQuestionId?: Id;
  /** 부모에게 보낼 답장 카드 (답이 위험이면 대신 alert만 옴) */
  replyCard?: Omit<Reply, "id" | "familyId" | "createdAt">;
  /** 부모에게 보낼 위험 알림 (가족이 당사자면 오지 않음) */
  alert?: Omit<Alert, "id" | "familyId" | "createdAt" | "readAt">;
  /** 공유 제안 — 코끼리 reply가 "엄마한테 같이 말해 볼까?"를 묻고, 아이 [좋아]면 화면이 Share를 accepted로 */
  shareProposal?: { summary: string };
  /** 아이가 그만하고 싶어 하면 true (reply는 작별 인사) */
  endConversation: boolean;
  /** 진짜 LLM이 아니라 가짜 응답이면 true (화면 테스트용 표시) */
  mock?: boolean;
};

// ───────────────────────── API: POST /api/parent/ask ─────────────────────────

export type ParentAskRequest = {
  familyId: Id;
  kidName?: string;
  /** 부모가 쓴 걱정·질문 (여러 개를 써도 됨) */
  text: string;
};

export type ParentAskResponse = {
  /** 질문 하나당 하나. 화면은 Question으로 저장하고 대기열에 넣는다 (대기는 한 번에 하나씩) */
  questions: { original: string; rewritten: string; whyChanged: string }[];
  mock?: boolean;
};

// ───────────────────────── API: POST /api/kid/done ─────────────────────────

export type KidDoneRequest = {
  familyId: Id;
  kidName?: string;
  /** 오늘 대화 (keepFromParent 표시 포함 — 서버가 일기에서 뺀다) */
  messages: Pick<Message, "from" | "text" | "category" | "keepFromParent">[];
};

export type KidDoneResponse = {
  /** 3줄 일기 (아이 시점, "말하지 마"·[싫어] 제외). 코인은 store.ts가 최소 기준·횟수 제한으로 준다 */
  diary: string[];
  mock?: boolean;
};

// ───────────────────────── API: POST /api/tts (구현됨) ─────────────────────────

export type TtsRequest = { text: string; voiceId?: string; previousText?: string };
// 응답: audio/mpeg

// ───────────────────────── 공통 오류 ─────────────────────────

export type ApiError = { error: string };
