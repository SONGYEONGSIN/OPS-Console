import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini API wrapper — AI 어시스턴트 단일 호출.
 * 환경변수: GEMINI_API_KEY (Google AI Studio 발급).
 * 모델: gemini-2.0-flash (저렴/빠름/1M context).
 */

const MODEL = "gemini-2.0-flash";
const MAX_OUTPUT_TOKENS = 1500;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AskGeminiInput = {
  systemInstruction: string;
  /** 단일 user content (single-shot) — 또는 messages history (multi-turn) 둘 중 하나 */
  userContent?: string;
  messages?: ChatMessage[];
};

export type AskGeminiResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function askGemini(input: AskGeminiInput): Promise<AskGeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { ok: false, error: "GEMINI_API_KEY 환경변수 누락" };
  }
  if (!input.userContent && !input.messages?.length) {
    return { ok: false, error: "userContent 또는 messages 필요" };
  }
  try {
    const client = new GoogleGenerativeAI(key);
    const model = client.getGenerativeModel({
      model: MODEL,
      systemInstruction: input.systemInstruction,
      generationConfig: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.3,
      },
    });
    // multi-turn: messages를 Gemini contents 형식으로 매핑 (assistant → model)
    if (input.messages?.length) {
      const contents = input.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const result = await model.generateContent({ contents });
      return { ok: true, text: result.response.text() };
    }
    // single-shot (legacy)
    const result = await model.generateContent(input.userContent!);
    return { ok: true, text: result.response.text() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `gemini_error: ${msg}` };
  }
}
