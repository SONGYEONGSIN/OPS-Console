"use client";

import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";

type Source = {
  domain: "incident" | "handover" | "ai-tip" | "backup" | "contact" | "service";
  id: string;
  title: string;
  snippet: string;
  deepLink: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** assistant 메시지에만 부착 */
  sources?: Source[];
  warning?: string;
  /** 진행 중 표시용 */
  pending?: boolean;
};

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

const EXAMPLES = [
  "외국인 전형 입력 오류는 어떻게 처리하지?",
  "지난달 가천대 백업 시점에 어떤 이슈가 있었어?",
  "한양대 연락처 알려줘",
  "Claude 프롬프트 추천 — 사고 보고서 작성용",
];

export function AssistantClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  // 새 메시지 추가 시 하단 자동 스크롤 (jsdom 환경에서 scrollIntoView 미구현 → guard)
  useEffect(() => {
    const el = endRef.current;
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || pending) return;
    const question = text.trim();
    const history: ChatMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "", pending: true },
    ]);
    setInput("");
    setPending(true);
    try {
      const res = await fetch("/api/assistant/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question,
          history: history.map((h) => ({ role: h.role, content: h.content })),
        }),
      });
      const json = (await res.json()) as
        | { ok: true; answer: string; sources: Source[]; warning?: string }
        | { ok: false; error: string };
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          if (json.ok) {
            copy[copy.length - 1] = {
              role: "assistant",
              content: json.answer,
              sources: json.sources,
              warning: json.warning,
            };
          } else {
            copy[copy.length - 1] = {
              role: "assistant",
              content: `❌ ${json.error}`,
            };
          }
        }
        return copy;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network_error";
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `❌ ${msg}`,
        };
        return copy;
      });
    } finally {
      setPending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 전송 / Shift+Enter 줄바꿈
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const reset = () => {
    setMessages([]);
    setInput("");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 메시지 영역 */}
      <div className="min-h-[320px] space-y-3 border border-line-soft bg-washi p-4">
        {messages.length === 0 ? (
          <EmptyState onPick={(ex) => send(ex)} />
        ) : (
          messages.map((m, i) => <MessageCard key={i} message={m} />)
        )}
        <div ref={endRef} />
      </div>

      {/* 입력 영역 */}
      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 flex flex-col gap-2 border border-line bg-cream p-3"
      >
        <textarea
          aria-label="질문 입력"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="질문을 입력하세요. Shift+Enter로 줄바꿈."
          rows={2}
          disabled={pending}
          maxLength={500}
          className="resize-none border border-line bg-cream px-3 py-2 text-sm text-ink"
        />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={pending || messages.length === 0}
            className="cursor-pointer border border-line bg-transparent px-3 py-1.5 text-xs text-ink hover:bg-washi disabled:cursor-not-allowed disabled:opacity-50"
          >
            대화 초기화
          </button>
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="cursor-pointer border border-line bg-ink px-4 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "답변 중…" : "전송"}
          </button>
        </div>
      </form>
    </div>
  );
}

function MessageCard({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] border border-line bg-ink px-3 py-2 text-sm text-cream">
          {message.content}
        </div>
      </div>
    );
  }
  // assistant
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <span className="text-2xs uppercase tracking-[0.18em] text-vermilion">
          어시스턴트
        </span>
      </div>
      {message.pending ? (
        <div className="max-w-[85%] border border-line-soft bg-washi-raised px-3 py-2 text-sm text-ink-soft">
          <span className="inline-block animate-pulse">답변 중…</span>
        </div>
      ) : (
        <div className="max-w-[85%] space-y-2">
          <p className="whitespace-pre-wrap border border-line-soft bg-washi-raised px-3 py-2 text-sm leading-relaxed text-ink">
            {message.content}
          </p>
          {message.warning && (
            <p className="text-2xs text-muted">⚠️ {message.warning}</p>
          )}
          {message.sources && message.sources.length > 0 && (
            <div className="space-y-1">
              <p className="text-2xs uppercase tracking-[0.18em] text-muted">
                근거
              </p>
              <div className="space-y-1">
                {message.sources.map((s, i) => (
                  <Link
                    key={`${s.domain}-${s.id}-${i}`}
                    href={s.deepLink}
                    className="block border border-line-soft bg-cream p-2 transition-colors hover:bg-washi-raised"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xs text-muted">[{i + 1}]</span>
                      <span
                        className={`inline-block px-2 py-0.5 text-2xs ${DOMAIN_TONE[s.domain]}`}
                      >
                        {DOMAIN_LABEL[s.domain]}
                      </span>
                      <span className="text-xs font-medium text-ink">
                        {s.title}
                      </span>
                    </div>
                    {s.snippet && (
                      <p className="mt-1 text-2xs text-ink-soft">{s.snippet}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="space-y-3 py-6">
      <p className="text-center text-sm text-muted">
        사내 데이터(사고·인수인계·TIP·백업·연락처·서비스)에 자연어로 질문하세요.
      </p>
      <div className="mx-auto max-w-[600px] space-y-1.5">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted">예시</p>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => onPick(ex)}
            className="block w-full cursor-pointer border border-line-soft bg-cream px-3 py-2 text-left text-xs text-ink transition-colors hover:bg-washi-raised"
          >
            · {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
