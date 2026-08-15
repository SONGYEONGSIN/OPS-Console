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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  /** Claude 모드 근거 — 볼트 문서 경로. Source[]와 달리 파일이라 경로가 곧 식별자다. */
  vaultSources?: string[];
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



/** Claude 모드 폴링 — 회사 PC가 답을 적을 때까지 기다린다. */
const POLL_MS = 2000;
/** 실측 30~45초. 3분이면 폴러가 물려 있는 것이다. */
const POLL_TIMEOUT_MS = 180_000;
/**
 * 이 시간 동안 pending에서 안 움직이면 아무도 claim하지 않은 것 = 회사 PC가 꺼졌다.
 * running으로 넘어갔다면 PC는 살아 있으니 이 판정을 하지 않는다.
 */
const UNCLAIMED_MS = 15_000;

type ClaudePoll = {
  ok: boolean;
  status?: string;
  answer?: string | null;
  sources?: string[];
  message?: string | null;
  error?: string;
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
  // 기본은 Gemini 즉답. Claude는 회사 PC를 타서 30초쯤 걸리므로 고를 때만 쓴다.
  const [deep, setDeep] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  // 새 메시지 추가 시 하단 자동 스크롤 (jsdom 환경에서 scrollIntoView 미구현 → guard)
  useEffect(() => {
    const el = endRef.current;
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  /** 마지막 assistant 메시지를 갈아끼운다 — 답·에러 모두 이 자리에 들어간다. */
  const replaceLast = (patch: Partial<ChatMessage> & { content: string }) => {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.role === "assistant") {
        copy[copy.length - 1] = {
          role: "assistant",
          ts: last.ts ?? new Date().toISOString(),
          ...patch,
        };
      }
      return copy;
    });
  };

  /**
   * Claude 모드 — 질문을 회사 PC 큐에 넣고 답이 적힐 때까지 폴링한다.
   * 답이 안 오는 이유가 두 가지(아직 도는 중 / PC가 꺼짐)라 구분해서 알린다.
   */
  const sendToClaude = async (question: string) => {
    const enq = await fetch("/api/assistant/claude", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question,
        ...(attachPage && pageContext
          ? { pageContext: `${pageContext.label} (${pageContext.path})` }
          : {}),
      }),
    });
    const enqJson = (await enq.json()) as { ok: boolean; id?: string; error?: string };
    if (!enqJson.ok || !enqJson.id) {
      replaceLast({ content: `❌ ${enqJson.error ?? "요청 적재 실패"}` });
      return;
    }

    const startedAt = Date.now();
    for (;;) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const elapsed = Date.now() - startedAt;

      const res = await fetch(`/api/assistant/claude?id=${enqJson.id}`);
      const json = (await res.json()) as ClaudePoll;

      if (json.status === "done") {
        replaceLast({
          content: json.answer ?? "",
          vaultSources: json.sources ?? [],
        });
        return;
      }
      if (json.status === "failed") {
        replaceLast({ content: `❌ ${json.message ?? "실행 실패"}` });
        return;
      }
      // 아무도 안 가져갔다 = 폴러가 안 돈다. 도는 척하지 않고 말한다.
      if (json.status === "pending" && elapsed > UNCLAIMED_MS) {
        replaceLast({
          content:
            "❌ 회사 PC가 응답하지 않습니다. Claude 모드는 회사 PC의 구독으로 도는데 폴러가 꺼져 있는 것 같습니다 — 빠른 답변 모드로 물어보세요.",
        });
        return;
      }
      if (elapsed > POLL_TIMEOUT_MS) {
        replaceLast({ content: "❌ 시간이 초과됐습니다 (3분)." });
        return;
      }
    }
  };

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
      if (deep) {
        await sendToClaude(question);
        return;
      }
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
        <div className="flex flex-wrap items-center gap-1.5">
          {/*
            Claude는 회사 PC의 구독으로 돌아 볼트 문서를 직접 읽는다(실측 30~45초).
            기본을 즉답으로 두는 이유는 PC가 꺼진 날에도 어시스턴트가 살아 있어야 해서다.
          */}
          <button
            type="button"
            aria-pressed={deep}
            onClick={() => setDeep((v) => !v)}
            className={`cursor-pointer border px-2.5 py-1 text-2xs transition-colors ${
              deep
                ? "border-vermilion bg-vermilion/10 text-vermilion"
                : "border-line-soft bg-transparent text-muted hover:bg-washi"
            }`}
          >
            Claude로 깊게 {deep ? "켜짐" : "꺼짐"}
          </button>
          {deep && (
            <span className="text-2xs text-muted">
              지식망 문서를 직접 읽습니다 · 30초쯤 걸립니다
            </span>
          )}
        </div>

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
            {/*
              지식망 페이지와 같은 react-markdown을 쓴다. 직전까지 손으로 짠 줄 단위
              렌더러라 불릿만 알았고, Claude가 잘 쓰는 제목·표가 날것으로 보였다.
              원시 HTML은 렌더하지 않는다(rehype-raw 미사용) — 답에 섞여도 실행 안 된다.
            */}
            <div className="chat-md space-y-1 border border-line-soft bg-washi-raised px-3.5 py-2.5 text-sm leading-relaxed text-ink">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
            {message.warning && (
              <p className="text-2xs text-muted">⚠️ {message.warning}</p>
            )}
            {/*
              Claude 모드 근거 — 모델이 실제로 Read한 볼트 문서다. 제목이 아니라 경로가
              식별자라(원본이 파일) 열람 화면도 경로로 연다.
            */}
            {message.vaultSources && message.vaultSources.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-2xs uppercase tracking-[0.18em] text-muted">
                  읽은 지식망 문서 {message.vaultSources.length}건
                </p>
                <div className="space-y-1">
                  {message.vaultSources.map((path) => (
                    <Link
                      key={path}
                      href={`/dashboard/knowledge?doc=${encodeURIComponent(path)}`}
                      className="flex items-baseline gap-2 border border-line-soft bg-cream px-2.5 py-2 transition-colors hover:bg-washi"
                    >
                      <span className="inline-block bg-vermilion/10 px-1.5 py-0.5 text-2xs text-vermilion">
                        지식망
                      </span>
                      <span className="text-xs font-medium text-ink">
                        {path.replace(/\.md$/, "")}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
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
