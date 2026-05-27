"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

type Source = {
  domain: "incident" | "handover" | "ai-tip" | "backup" | "contact" | "service";
  id: string;
  title: string;
  snippet: string;
  deepLink: string;
};

type AskResponse =
  | {
      ok: true;
      answer: string;
      sources: Source[];
      warning?: string;
    }
  | { ok: false; error: string };

const DOMAIN_LABEL: Record<Source["domain"], string> = {
  incident: "사고",
  handover: "인수인계",
  "ai-tip": "TIP",
  backup: "백업",
  contact: "연락처",
  service: "서비스",
};

const DOMAIN_TONE: Record<Source["domain"], string> = {
  incident: "bg-vermilion/15 text-vermilion",
  handover: "bg-sage/15 text-sage",
  "ai-tip": "bg-washi-raised text-ink",
  backup: "bg-washi-raised text-ink-soft",
  contact: "bg-line-soft text-ink",
  service: "bg-line-soft text-ink-soft",
};

const PLACEHOLDER_EXAMPLES = [
  "외국인 전형 입력 오류는 어떻게 처리하지?",
  "지난달 가천대 백업 시점에 어떤 이슈가 있었어?",
  "한양대 연락처 알려줘",
  "Claude 프롬프트 추천 — 사고 보고서 작성용",
];

export function AssistantClient() {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AskResponse | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim() || pending) return;
    setPending(true);
    setResult(null);
    try {
      const res = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: question.trim() }),
      });
      const json = (await res.json()) as AskResponse;
      setResult(json);
    } catch (err) {
      setResult({
        ok: false,
        error: err instanceof Error ? err.message : "network_error",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-2">
        <label htmlFor="ai-q" className="block text-xs text-muted">
          질문 입력
        </label>
        <div className="flex gap-2">
          <input
            id="ai-q"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={PLACEHOLDER_EXAMPLES[0]}
            disabled={pending}
            maxLength={500}
            className="flex-1 border border-line bg-cream px-3 py-2 text-sm text-ink"
          />
          <button
            type="submit"
            disabled={pending || !question.trim()}
            className="cursor-pointer border border-line bg-ink px-4 py-2 text-sm font-medium text-cream hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "찾는 중…" : "질문"}
          </button>
        </div>
      </form>

      {!result && (
        <section className="space-y-1.5">
          <p className="text-2xs uppercase tracking-[0.18em] text-muted">예시</p>
          <ul className="space-y-1 text-xs text-ink-soft">
            {PLACEHOLDER_EXAMPLES.map((ex) => (
              <li key={ex}>
                <button
                  type="button"
                  onClick={() => setQuestion(ex)}
                  className="cursor-pointer border-none bg-transparent p-0 text-left text-vermilion hover:text-vermilion-deep"
                >
                  · {ex}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result && !result.ok && (
        <section className="rounded border border-vermilion/30 bg-vermilion/5 p-3 text-sm text-ink">
          ❌ {result.error}
        </section>
      )}

      {result && result.ok && (
        <>
          <section className="space-y-2">
            <p className="text-2xs uppercase tracking-[0.18em] text-muted">
              답변
            </p>
            <p className="whitespace-pre-wrap rounded border border-line-soft bg-washi-raised p-3 text-sm leading-relaxed text-ink">
              {result.answer}
            </p>
            {result.warning && (
              <p className="text-2xs text-muted">⚠️ {result.warning}</p>
            )}
          </section>

          {result.sources.length > 0 && (
            <section className="space-y-2">
              <p className="text-2xs uppercase tracking-[0.18em] text-muted">
                근거
              </p>
              <div className="space-y-1.5">
                {result.sources.map((s, i) => (
                  <Link
                    key={`${s.domain}-${s.id}`}
                    href={s.deepLink}
                    className="block border border-line-soft bg-cream p-2.5 transition-colors hover:bg-washi-raised"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xs text-muted">[{i + 1}]</span>
                      <span
                        className={`inline-block px-2 py-0.5 text-2xs ${DOMAIN_TONE[s.domain]}`}
                      >
                        {DOMAIN_LABEL[s.domain]}
                      </span>
                      <span className="text-sm font-medium text-ink">
                        {s.title}
                      </span>
                    </div>
                    {s.snippet && (
                      <p className="mt-1 text-xs text-ink-soft">{s.snippet}</p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
