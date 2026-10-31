// LLM 호출 (서버 전용). 래블업 토큰팩토리 = OpenAI 호환 API: POST https://api.console.lablup.ai/v1/chat/completions
// 환경변수: LLM_BASE_URL, LLM_API_KEY, LLM_MODEL. 하나라도 없으면 null → 호출한 쪽이 가짜 응답으로 대체한다

export function isLlmConfigured(): boolean {
  return Boolean(process.env.LLM_BASE_URL && process.env.LLM_API_KEY && process.env.LLM_MODEL);
}

export type ChatOptions = { maxTokens?: number; temperature?: number; timeoutMs?: number };

/** system + user를 보내고 답 글자를 돌려준다. 설정이 없거나 실패·시간 초과면 null */
export async function chatComplete(system: string, user: string, opts: ChatOptions = {}): Promise<string | null> {
  if (!isLlmConfigured()) return null;
  const base = process.env.LLM_BASE_URL!.replace(/\/+$/, "");
  const url = base.endsWith("/chat/completions") ? base : `${base}/chat/completions`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? Number(process.env.LLM_TIMEOUT_MS || 12000)); // 음성 대화라 오래 못 기다린다
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${process.env.LLM_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.LLM_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: opts.maxTokens ?? 1500, // 생각 과정(reasoning)도 토큰을 써서 넉넉히
        temperature: opts.temperature ?? 0.6,
      }),
    });
    if (!res.ok) {
      console.error("LLM 오류", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    // 생각 과정을 답에 붙이는 모델(DeepSeek 등)이 있어 지운다
    return typeof text === "string" ? text.replace(/<think>[\s\S]*?<\/think>/g, "").trim() : null;
  } catch (e) {
    console.error("LLM 호출 실패", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
