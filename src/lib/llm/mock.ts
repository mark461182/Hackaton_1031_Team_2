// 가짜 응답 (docs/09 1장 4번): 키 없이도 types.ts와 같은 모양으로 돌아가서 화면을 먼저 만들 수 있게 한다.
// 규칙 기반이라 말투는 단순하지만, 데모 체크 문장(위험·가족·말하지 마·부모 질문)에는 진짜 규칙대로 반응한다.
// 진짜 LLM(Bedrock)이 붙으면 API 경로가 이 함수 대신 LLM을 부른다. 응답 모양은 그대로.

import type {
  Category,
  Involved,
  KidChatRequest,
  KidChatResponse,
  KidDoneRequest,
  KidDoneResponse,
  ParentAskRequest,
  ParentAskResponse,
  RiskType,
} from "@/lib/types";

const has = (text: string, re: RegExp) => re.test(text.replace(/\s+/g, " "));

// ───────────── 분류 ─────────────

const RISK: [RiskType, RegExp][] = [
  ["self_harm", /죽고\s?싶|죽을래|사라지고\s?싶|나를?\s?다치게|자해/],
  ["adult_contact", /(만졌|만지|몸을?\s?보여|옷\s?벗)|비밀로\s?하라|비밀이라고\s?했/],
  ["stranger", /모르는\s?(아저씨|아줌마|사람|어른)/],
  ["violence", /때려|때렸|때리|맞았|맞아|발로\s?차|밀쳤|꼬집/],
  ["bullying", /괴롭|따돌|왕따|나만\s?빼고|놀려|놀렸|놀린|협박|돈\s?뺏/],
  ["neglect", /밥을?\s?못\s?먹|밥\s?안\s?줘|집에\s?아무도\s?없|혼자\s?있어야/],
];

// 가족은 "그 일을 한 사람"일 때만: "아빠가", "엄마가", "우리 형이". "엄마한테 말하지 마"의 엄마는 듣는 사람이라 아님
// 받아쓰기가 뭉개진 형태(아바·어마)와 띄어쓰기 없는 문장("아빠가떼려")도 잡는다 (분류 견고성 실험)
const FAMILY_WORD = "새아빠|새엄마|아빠|엄마|아바|어마|할머니|할아버지|삼촌|이모|고모|형|누나|언니|오빠";
const FAMILY_ACTOR = new RegExp(`(^|\\s|우리\\s?)(${FAMILY_WORD})(가|이|께서)|우리\\s?(${FAMILY_WORD})(?!한테|한태|헌테|에게|에개|께|보고|더러|랑|들)`);
const FAMILY_LISTENER = new RegExp(`(${FAMILY_WORD})(한테|한태|헌테|에게|에개|께|보고|더러)`);
const TEACHER = /선생님|선생|쌤|원장/;
const STRANGER = /모르는\s?(아저씨|아줌마|사람|어른)/;
const FRIEND = /친구|짝꿍|짝궁|작꿍|반\s?애들|애들|형들|누나들|언니들|오빠들/;

const SHARE = /속상|짜증|싫어|무서워|무서웠|걱정|슬퍼|슬펐|울었|혼났|외로|창피|미워|서운/;
const DONT_TELL = /말하지\s?마|말\s?하지\s?마|말하면\s?안\s?돼|비밀이야|아무한테도\s?말/;
const END = /^(그만|끝|안녕|이제\s?갈래|졸려)/;

export function detectRisk(text: string): RiskType | undefined {
  for (const [type, re] of RISK) if (has(text, re)) return type;
  return undefined;
}

/** 가족이 그 일을 한 사람으로 나오는지 ("아빠가 때려" O, "엄마한테 말하지 마" X) */
export function hasFamilyActor(text: string): boolean {
  return FAMILY_ACTOR.test(text);
}

/** 가족이 듣는 사람으로만 나오는지 ("엄마한테 말하지 마") — 이때는 가족을 당사자로 보지 않는다 */
export function familyOnlyListener(text: string): boolean {
  return FAMILY_LISTENER.test(text) && !hasFamilyActor(text);
}

export function detectInvolved(text: string): Involved {
  if (has(text, STRANGER)) return "stranger";
  if (hasFamilyActor(text)) return "family";
  if (has(text, TEACHER)) return "teacher";
  if (has(text, FRIEND)) return "friend";
  return "none";
}

export function classify(text: string): { category: Category; riskType?: RiskType; involved: Involved } {
  const riskType = detectRisk(text);
  const involved = detectInvolved(text);
  if (riskType) return { category: "risk", riskType, involved };
  if (has(text, SHARE)) return { category: "share", involved };
  return { category: "daily", involved };
}

// ───────────── /api/kid/chat ─────────────

/** 대기 질문을 꼭 묻는 시점: 대기를 시작하고 아이가 이만큼 말했을 때 (1 = 두 번째 아이 말에) */
export const ASK_AFTER_KID_TURNS = 1;

const SITUATION: Record<RiskType, string> = {
  bullying: "친구 관계에서 괴롭힘이나 따돌림을 겪고 있는 것 같아요",
  violence: "누군가에게 맞거나 다치는 일이 있었던 것 같아요",
  self_harm: "스스로를 해치고 싶다는 마음을 말했어요",
  adult_contact: "어른과의 사이에서 불편한 일이 있었던 것 같아요",
  stranger: "모르는 사람과 관련된 일이 있었던 것 같아요",
  neglect: "돌봄이 필요한 상황에 있는 것 같아요",
  other: "아이가 힘든 일을 겪고 있는 것 같아요",
};
const GUIDE = "혼내지 않을 거라고 먼저 말해 주고, 아이가 쓴 말 그대로 '그 얘기 엄마한테도 해 줄래?'로 천천히 시작해 보세요. 자세한 걸 한꺼번에 캐묻지 않는 게 좋아요";

/** 아이 말에서 1~2문장만 (위험 알림 원문) */
function quoteOf(text: string): string {
  const s = text.trim().split(/(?<=[.!?。])\s+/).slice(0, 2).join(" ");
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

/** 아이 말 앞부분을 받아 되돌려 주기 (서로 다른 입력 → 서로 다른 답) */
function echo(text: string): string {
  const t = text.replace(/[.!?~]+$/g, "").trim();
  return t.length > 14 ? `${t.slice(0, 14)}…` : t;
}

const pick = <T,>(arr: T[], seed: string) => arr[[...seed].reduce((a, c) => a + c.charCodeAt(0), 0) % arr.length];

export function mockKidChat(req: KidChatRequest): KidChatResponse {
  const text = req.kidText.trim();
  const { category, riskType, involved } = classify(text);
  const dontTell = has(text, DONT_TELL);
  const q = req.pendingQuestion;
  const base = { involved, mock: true as const, endConversation: false };

  if (has(text, END)) {
    return { ...base, reply: "오늘 얘기해 줘서 고마워. 또 놀자!", choices: [], category: "daily", endConversation: true };
  }

  // 위험: 공감하고 혼자 참지 않게 권함 (전달된다고 말하지 않음). 가족이 당사자면 알림 없음
  if (category === "risk") {
    const family = involved === "family";
    const reply = family
      ? "말해 줘서 정말 고마워. 그건 네 잘못이 아니야. 선생님처럼 믿을 수 있는 다른 어른한테 말해 볼 수 있어?"
      : riskType === "self_harm"
        ? "말해 줘서 정말 고마워. 그런 마음이 들 만큼 많이 힘들었구나. 지금 옆에 있는 어른한테 꼭 말해 줄 수 있어?"
        : "말해 줘서 정말 고마워. 많이 무서웠겠다. 그건 네 잘못이 아니야.";
    const answered = q?.askedAt ? q.id : undefined;
    return {
      ...base,
      reply,
      choices: family ? ["선생님한테 말할래", "아직 무서워", "다른 얘기 할래"] : ["무서웠어", "더 말하기 싫어", "다른 얘기 할래"],
      category,
      riskType,
      answeredQuestionId: answered,
      // 부모 질문의 답이 위험이어도 답장 카드 대신 위험 알림 하나
      alert: family ? undefined : { quote: quoteOf(text), situation: SITUATION[riskType ?? "other"], guide: GUIDE, riskType: riskType ?? "other" },
    };
  }

  // 대기 질문에 대한 답 (이미 물었음)
  if (q?.askedAt) {
    const reply = dontTell
      ? "알겠어, 말하고 싶을 때 말해 줘. 오늘 제일 재밌었던 건 뭐야?"
      : pick(["우와, 진짜? 그래서 어떻게 됐어?", "그랬구나. 그때 너는 어떤 기분이었어?", `'${echo(text)}'라고? 그 얘기 더 해 줄래?`], text);
    return {
      ...base,
      reply,
      choices: ["또 있어", "그냥 그래", "다른 얘기 할래"],
      category,
      keepFromParent: dontTell ? "dont_tell" : undefined,
      answeredQuestionId: q.id,
      // "말하지 마"면 답장 카드에 쓰지 않는다
      replyCard: dontTell
        ? undefined
        : {
            questionId: q.id,
            answer: text,
            summary: `아이가 "${echo(text)}"라고 답했어요`,
            note: "아이가 쓴 말을 그대로 받아서 저녁에 '그 얘기 더 해 줄래?'로 이어 보세요",
          },
    };
  }

  // 대기 질문을 꺼낼 때 (몇 턴 안에 꼭)
  const askNow = q && !q.askedAt && q.kidTurnsWaiting >= ASK_AFTER_KID_TURNS;
  const lead =
    category === "share"
      ? `그래서 ${pick(["속상했구나", "마음이 안 좋았구나", "많이 신경 쓰였구나"], text)}.`
      : pick(["우와, 그랬구나.", "오, 진짜?", "응응, 재밌다."], text);

  if (askNow) {
    return {
      ...base,
      reply: `${lead} 그런데 나 궁금한 게 있어. ${q!.rewritten}`,
      choices: ["말해 줄게", "잘 모르겠어", "말하기 싫어"],
      category,
      keepFromParent: dontTell ? "dont_tell" : undefined,
      askedQuestionId: q!.id,
    };
  }

  // 공유 제안: 엄마한테 같이 말할지 묻는 유일한 길 ("말하지 마"면 제안하지 않음)
  if (category === "share" && !dontTell) {
    return {
      ...base,
      reply: `${lead} 이 얘기 엄마한테도 같이 말해 볼까?`,
      choices: ["좋아", "싫어"],
      category,
      shareProposal: { summary: `아이가 "${echo(text)}"라고 말했어요` },
    };
  }

  return {
    ...base,
    reply: dontTell
      ? "알겠어. 여기서는 혼나는 거 없어. 다른 재밌는 얘기 해 줄래?"
      : `${lead} ${pick(["그 얘기 더 해 줄래?", "그다음엔 뭐 했어?", "그때 기분은 어땠어?"], text + "x")}`,
    choices: dontTell ? ["좋아", "그만할래"] : ["더 말해 줄게", "다른 얘기", "그만할래"],
    category,
    keepFromParent: dontTell ? "dont_tell" : undefined,
  };
}

// ───────────── /api/parent/ask ─────────────

// 위에서부터 먼저 맞는 것 (구체적인 것이 앞)
const REWRITES: [RegExp, string][] = [
  [/싸웠|다퉜/, "오늘 친구들이랑 놀 때 어떤 일이 있었는지 얘기해 줄래?"],
  [/왜\s?.*말\s?안|말을?\s?안\s?해/, "요즘 말하기 어려웠던 일 있으면, 누구한테 얘기하면 마음이 편해질 것 같아?"],
  [/친구|짝꿍|따돌|왕따/, "요즘 같이 노는 친구 중에 제일 재밌는 친구는 누구야?"],
  [/선생님|담임/, "요즘 선생님이 해 준 얘기 중에 기억나는 거 있어?"],
  [/학원/, "학원에서 제일 재밌는 시간은 언제야?"],
  [/숙제|공부/, "오늘 숙제는 어떻게 하고 있어?"],
  [/학교|급식|쉬는\s?시간/, "오늘 학교에서 제일 웃겼던 일은 뭐야?"],
  [/기분|우울|힘들|속상/, "요즘 제일 신나는 일이랑 제일 속상한 일은 뭐야?"],
];
const LEADING = /했지\?|했지$|지\?|왜\s?.*안\s?했|왜\s?말\s?안|거짓말/;

export function mockParentAsk(req: ParentAskRequest): ParentAskResponse {
  const parts = req.text
    .split(/[?？\n]|그리고/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
  const questions = (parts.length ? parts : [req.text]).slice(0, 3).map((original) => {
    const rewritten = REWRITES.find(([re]) => re.test(original))?.[1] ?? "요즘 제일 신나는 일은 뭐야?";
    const whyChanged = LEADING.test(original + "?")
      ? "답을 정해 놓은 질문은 아이가 방어적으로 입을 닫기 쉬워서, 있었던 일을 편하게 말할 수 있는 열린 질문으로 바꿨어요."
      : "아이가 예/아니오가 아니라 자기 이야기로 답할 수 있게 열린 질문으로 바꿨어요.";
    return { original, rewritten, whyChanged };
  });
  return { questions, mock: true };
}

// ───────────── /api/kid/done ─────────────

export function mockKidDone(req: KidDoneRequest): KidDoneResponse {
  const kidLines = req.messages
    .filter((m) => m.from === "kid" && !m.keepFromParent && m.category !== "risk")
    .map((m) => echo(m.text))
    .filter(Boolean);
  const diary = kidLines.length
    ? [
        `오늘 코끼리랑 "${kidLines[0]}" 얘기를 했다.`,
        kidLines[1] ? `"${kidLines[1]}" 얘기도 했다.` : "코끼리가 내 얘기를 잘 들어 줬다.",
        "내일도 코끼리랑 얘기해야지.",
      ]
    : ["오늘 코끼리랑 인사를 했다.", "코끼리가 내 얘기를 기다려 줬다.", "내일은 더 많이 얘기해야지."];
  return { diary, mock: true };
}
