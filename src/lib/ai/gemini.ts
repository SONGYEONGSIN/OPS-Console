import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini API wrapper — AI 어시스턴트 단일 호출.
 * 환경변수: GEMINI_API_KEY (Google AI Studio 발급).
 * 모델: gemini-2.0-flash (저렴/빠름/1M context).
 */

const MODEL = "gemini-2.0-flash";
const MAX_OUTPUT_TOKENS = 1500;

export type AskGeminiInput = {
  systemInstruction: string;
  userContent: string;
};

export type AskGeminiResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function askGemini(input: AskGeminiInput): Promise<AskGeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return { ok: false, error: "GEMINI_API_KEY 환경변수 누락" };
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
    const result = await model.generateContent(input.userContent);
    const text = result.response.text();
    return { ok: true, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `gemini_error: ${msg}` };
  }
}
