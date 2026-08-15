"use client";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { usePathname } from "next/navigation";
import { findSidebarMeta } from "../../_data";
import Link from "next/link";

/**
 * 서버 `features/assistant/search.ts`의 Source와 같은 모양을 여기 다시 적는다 —
 * 그쪽은 server-only라 client가 import할 수 없다. **도메인을 추가할 때 양쪽을
 * 같이 고쳐야 한다**(안 고치면 라벨이 없어 배지가 빈칸으로 나온다).
 */
type Source = {
  domain:
    | "knowledge"
    | "incident"
    | "handover"
    | "ai-tip"
    | "backup"
    | "contact"
    | "service";
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
  /** 메시지 발생 시각 (KST 표시) */
  ts?: string;
};

const DOMAIN_LABEL: Record<Source["domain"], string> = {
  knowledge: "지식망",
  incident: "사고",
  handover: "인수인계",
  "ai-tip": "TIP",
  backup: "백업",
  contact: "연락처",
  service: "서비스",
};

const DOMAIN_TONE: Record<Source["domain"], string> = {
  knowledge: "bg-vermilion/10 text-vermilion",
  incident: "bg-vermilion/15 text-vermilion",
  handover: "bg-sage/15 text-sage",
  "ai-tip": "bg-washi-raised text-ink",
  backup: "bg-washi-raised text-ink-soft",
  contact: "bg-line-soft text-ink",
  service: "bg-line-soft text-ink-soft",
};

/**
 * 빈 화면 예시 — 460px 패널에 담기게 4개만. 한 줄에 들어가는 길이로 짧게 쓴다.
 * 지식망을 앞에 둔 이유: 절차·규칙은 문서가 답하는 게 맞고, 그 경로를 먼저 보여줘야
 * 운영자가 "지식망에 쓰면 여기서 답이 나온다"를 알게 된다.
 */
const EXAMPLES = [
  "경위서 어떻게 보내지?",
  "공문 시행번호는 어떻게 매겨져?",
  "외국인 전형 입력 오류 사례 있어?",
  "한양대 연락처 알려줘",
];

/** KST HH:mm 시간 포매팅 */
function formatTimeKst(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/**
 * 단순 마크다운 → React nodes (Gemini가 자주 쓰는 형식만 가벼이 처리).
 * 의존성 추가 없이 ** ** bold + `code` inline + - bullet 만.
 */
function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let i = 0;
  // 패턴: **bold** | `code` | 그 외 텍스트
  const re = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > i) parts.push(text.slice(i, m.index));
    if (m[2] !== undefined) {
      parts.push(
        <strong key={`b${key++}`} className="font-semibold text-ink">
          {m[2]}
        </strong>,
      );
    } else if (m[3] !== undefined) {
      parts.push(
        <code
          key={`c${key++}`}
          className="rounded bg-washi px-1 py-0.5 font-mono text-[11px] text-ink"
        >
          {m[3]}
        </code>,
      );
    }
    i = m.index + m[0].length;
  }
  if (i < text.length) parts.push(text.slice(i));
  return parts;
}

function renderMarkdown(text: string): React.ReactNode {
  // 줄 단위로 - bullet 처리 + 빈 줄은 spacing
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let bulletGroup: string[] = [];
  const flushBullets = () => {
    if (bulletGroup.length === 0) return;
    blocks.push(
      <ul key={`u${blocks.length}`} className="my-1 list-disc space-y-0.5 pl-5">
        {bulletGroup.map((b, i) => (
          <li key={i}>{renderInline(b)}</li>
        ))}
      </ul>,
    );
    bulletGroup = [];
  };
  lines.forEach((line, i) => {
    const trimmed = line.trimStart();
    if (/^[-•]\s+/.test(trimmed)) {
      bulletGroup.push(trimmed.replace(/^[-•]\s+/, ""));
    } else {
      flushBullets();
      if (line.trim() === "") {
        blocks.push(<div key={`s${i}`} className="h-2" aria-hidden />);
      } else {
        blocks.push(<p key={i}>{renderInline(line)}</p>);
      }
    }
  });
  flushBullets();
  return <>{blocks}</>;
}

const ASSISTANT_NAME = "운영부 상황실 어시스턴트";

/** OPS Console 시스템 로고를 아바타로 사용 — ChromeBrand의 '>_' 모티프 차용. */
function AssistantAvatar({
  size,
  fontSize,
}: {
  size: "sm" | "lg";
  fontSize: string;
}) {
  const dim = size === "sm" ? "h-11 w-11" : "h-20 w-20";
  return (
    <span
      aria-hidden
      className={`flex flex-shrink-0 items-center justify-center border border-line bg-chrome-graphite font-mono font-bold leading-none tracking-[-0.05em] text-chrome-snow ${dim} ${fontSize}`}
    >
      &gt;_
    </span>
  );
}

type Props = {
  /** 운영자 표시명 (사용자 메시지 캐릭터에 사용) */
  userName?: string;
};



export function AssistantClient({ userName = "운영자" }: Props) {
  const pathname = usePathname();
  const [attachPage, setAttachPage] = useState(true);

  // 지금 열려 있는 화면 — 사이드바에 등록된 메뉴일 때만 붙인다.
  // 상세 경로(/dashboard/incident-reports/{id})도 첫 세그먼트로 메뉴를 찾는다.
  const pageContext = useMemo(() => {
    const slug = pathname?.split("/")[2];
    if (!slug) return null;
    const meta = findSidebarMeta(slug);
    if (!meta) return null;
    return { path: pathname, label: meta.label, pattern: meta.pattern };
  }, [pathname]);
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
    const nowIso = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question, ts: nowIso },
      { role: "assistant", content: "", pending: true, ts: nowIso },
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
          ...(attachPage && pageContext ? { pageContext } : {}),
        }),
      });
      const json = (await res.json()) as
        | { ok: true; answer: string; sources: Source[]; warning?: string }
        | { ok: false; error: string };
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          const ts = last.ts ?? new Date().toISOString();
          if (json.ok) {
            copy[copy.length - 1] = {
              role: "assistant",
              content: json.answer,
              sources: json.sources,
              warning: json.warning,
              ts,
            };
          } else {
            copy[copy.length - 1] = {
              role: "assistant",
              content: `❌ ${json.error}`,
              ts,
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
    <div className="flex h-full min-h-0 flex-col">
      {/* 메시지 영역 — worklog 패턴: 화면 전체 폭 (parent p-7 padding 사용) */}
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-washi px-5 py-4">
        {messages.length === 0 ? (
          <EmptyState onPick={(ex) => send(ex)} />
        ) : (
          messages.map((m, i) => (
            <MessageCard key={i} message={m} userName={userName} />
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* 입력 영역 — page는 sticky 하단, panel은 패널 바닥 고정 */}
      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 flex-col gap-2 border-t border-line bg-cream px-5 py-3"
      >
        {/* 첨부할 화면 정보가 없으면 칩도 그리지 않는다 — 켜도 아무 일이 안 일어난다. */}
        {pageContext && (
          <div>
            <button
              type="button"
              aria-pressed={attachPage}
              onClick={() => setAttachPage((v) => !v)}
              className={`cursor-pointer border px-2.5 py-1 text-2xs transition-colors ${
                attachPage
                  ? "border-vermilion bg-vermilion/10 text-vermilion"
                  : "border-line-soft bg-transparent text-muted hover:bg-washi"
              }`}
            >
              현재 페이지 첨부 {attachPage ? "켜짐" : "꺼짐"} · {pageContext.label}
            </button>
          </div>
        )}
        <textarea
          aria-label="질문 입력"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="어떤 정보를 찾으시나요? Shift+Enter로 줄바꿈, Enter로 전송."
          rows={2}
          disabled={pending}
          maxLength={500}
          className="resize-none border-none bg-transparent px-2 py-1 text-sm text-ink outline-none focus:ring-0"
        />
        <div className="flex items-center justify-between gap-2 border-t border-line-soft pt-2">
          <button
            type="button"
            onClick={reset}
            disabled={pending || messages.length === 0}
            className="cursor-pointer border border-line bg-transparent px-3 py-1.5 text-xs text-ink-soft hover:bg-washi disabled:cursor-not-allowed disabled:opacity-50"
          >
            대화 초기화
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xs text-muted">
              {input.length}/500
            </span>
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="cursor-pointer border border-line bg-ink px-4 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "답변 중…" : "전송"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function MessageCard({
  message,
  userName,
}: {
  message: ChatMessage;
  userName: string;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const userInitial = userName.slice(0, 1);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[78%] flex-col items-end gap-1">
          <div className="mb-1 flex items-center gap-1.5 text-2xs text-muted">
            <span>{userName}</span>
            <span aria-hidden>·</span>
            {message.ts && <span>{formatTimeKst(message.ts)}</span>}
          </div>
          <div className="flex items-start gap-2.5">
            <div className="border border-line bg-ink px-4 py-2.5 text-sm leading-relaxed text-cream">
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
            <div
              aria-hidden
              className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center border border-line bg-cream text-lg font-semibold text-ink"
            >
              {userInitial}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // assistant
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5">
        <AssistantAvatar size="sm" fontSize="text-xl" />
      </div>
      <div className="flex max-w-[82%] flex-col gap-1">
        <div className="mb-1 flex items-center gap-1.5 text-2xs text-muted">
          <span className="font-medium text-vermilion">{ASSISTANT_NAME}</span>
          {message.ts && (
            <>
              <span aria-hidden>·</span>
              <span>{formatTimeKst(message.ts)}</span>
            </>
          )}
        </div>
        {message.pending ? (
          <div className="border border-line-soft bg-washi-raised px-3.5 py-2 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex h-1.5 items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-vermilion [animation-delay:0ms]" />
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-vermilion [animation-delay:150ms]" />
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-vermilion [animation-delay:300ms]" />
              </span>
              답변 중…
            </span>
          </div>
        ) : (
          <>
            <div className="space-y-1 border border-line-soft bg-washi-raised px-3.5 py-2.5 text-sm leading-relaxed text-ink">
              {renderMarkdown(message.content)}
            </div>
            {message.warning && (
              <p className="text-2xs text-muted">⚠️ {message.warning}</p>
            )}
            {message.sources && message.sources.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-2xs uppercase tracking-[0.18em] text-muted">
                  근거 {message.sources.length}건
                </p>
                <div className="space-y-1">
                  {message.sources.map((s, i) => (
                    <Link
                      key={`${s.domain}-${s.id}-${i}`}
                      href={s.deepLink}
                      className="block border border-line-soft bg-cream px-2.5 py-2 transition-colors hover:bg-washi"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xs text-muted">[{i + 1}]</span>
                        <span
                          className={`inline-block px-1.5 py-0.5 text-2xs ${DOMAIN_TONE[s.domain]}`}
                        >
                          {DOMAIN_LABEL[s.domain]}
                        </span>
                        <span className="text-xs font-medium text-ink">
                          {s.title}
                        </span>
                      </div>
                      {s.snippet && (
                        <p className="mt-1 text-2xs leading-relaxed text-ink-soft">
                          {s.snippet}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 pt-1 text-2xs text-muted">
              <button
                type="button"
                onClick={handleCopy}
                className="cursor-pointer border-none bg-transparent p-0 underline-offset-2 hover:text-ink hover:underline"
              >
                {copied ? "복사됨" : "답변 복사"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="space-y-4 py-6">
      <div className="flex items-center gap-3">
        <AssistantAvatar size="sm" fontSize="text-base" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{ASSISTANT_NAME}</p>
          <p className="text-xs text-muted">
            업무 지식망과 운영 데이터에서 찾아 답합니다.
          </p>
        </div>
      </div>
      <ul className="space-y-1.5">
        {EXAMPLES.map((ex) => (
          <li key={ex}>
            <button
              type="button"
              onClick={() => onPick(ex)}
              className="w-full cursor-pointer border border-line-soft bg-cream px-3 py-2 text-left text-xs leading-relaxed text-ink transition-colors hover:border-line hover:bg-line-soft"
            >
              {ex}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
