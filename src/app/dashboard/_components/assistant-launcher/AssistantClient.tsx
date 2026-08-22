"use client";

import { kstFormat } from "@/lib/kst-format";
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
import { MARKDOWN_REMARK_PLUGINS } from "@/components/common/markdown-plugins";
import {
  pendingNoteFor,
  STAGE_QUEUED,
  STAGE_STILL_QUEUED,
} from "@/features/assistant/stage-label";
import { PendingLine } from "./PendingLine";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** 도는 동안 지금 무엇을 하고 있는지 (Claude 모드는 30초쯤 걸린다) */
  pendingNote?: string;
  /** 근거 — 모델이 실제로 Read한 볼트 문서 경로. 원본이 파일이라 경로가 곧 식별자다. */
  vaultSources?: string[];
  /** 진행 중 표시용 */
  pending?: boolean;
  /** 기다리기 시작한 시각(ms) — 경과 시간 표시에 쓴다 */
  pendingSince?: number;
  /** 메시지 발생 시각 (KST 표시) */
  ts?: string;
};

/**
 * 빈 화면 예시 — 460px 패널에 담기게 4개만. 한 줄에 들어가는 길이로 짧게 쓴다.
 * 지식망을 앞에 둔 이유: 절차·규칙은 문서가 답하는 게 맞고, 그 경로를 먼저 보여줘야
 * 운영자가 "지식망에 쓰면 여기서 답이 나온다"를 알게 된다.
 */
const EXAMPLES = [
  "경위서 보내는 절차 정리해줘",
  "공문 시행번호 매기는 규칙 알려줘",
  "다음주 휴가자 뽑아줘",
  "한양대 담당자 연락처 찾아줘",
];

/** KST HH:mm 시간 포매팅 */
function formatTimeKst(iso: string): string {
  return kstFormat({
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * 단순 마크다운 → React nodes (모델이 자주 쓰는 형식만 가벼이 처리).
 * 의존성 추가 없이 ** ** bold + `code` inline + - bullet 만.
 */

/**
 * 발화자 이름 — agent-org 조직도의 '조율' 자리가 곧 이 어시스턴트이고 이름이
 * 명보다(`features/agent-org/registry.ts`). 그 이름이 조직도 화면에만 있고
 * 정작 말을 거는 자리에는 없어서, 동료가 아니라 기능처럼 읽혔다.
 */
const ASSISTANT_NAME = "명보";

/** 빈 상태 자기소개 — 누구이고 어떻게 답하는지. 소요 시간은 헤더가 이미 말한다. */
const INTRO =
  "안녕하세요, 운영부 상황실 명보입니다. 절차·규칙은 업무 지식망 문서에서, 일정·연락처·서비스 현황은 운영 데이터에서 직접 찾아옵니다. 결론을 먼저 말하고 어느 문서에서 나왔는지 뒤에 붙입니다. 모르면 모른다고 하고, 대신 실행할 일은 무엇을 어디에 하는지 말한 뒤 확인받고 합니다.";

/** OPS Console 시스템 로고를 아바타로 사용 — ChromeBrand의 '>_' 모티프 차용. */
/**
 * 명보 스프라이트 — 8×8 픽셀 도안. 헤드셋 쓴 관제 요원이다(상황실에서 듣고
 * 조율하는 자리라서).
 *
 * 전에는 `>_` 터미널 글리프였는데 그건 사이드바 브랜드와 같은 결이라
 * 어시스턴트만의 얼굴이 아니었다. `1` 이 칠할 칸이다.
 */
const SPRITE = [
  "00111100",
  "01111110",
  "11011011",
  "11111111",
  "10111101",
  "00100100",
  "01111110",
  "11000011",
] as const;

/**
 * 픽셀 도안을 SVG rect 로 그린다.
 *
 * 이미지 파일 대신 SVG 인 이유는 44px·80px 두 크기에서 다 또렷해야 하기
 * 때문이다. 색은 `currentColor` 라 부모의 Tailwind 토큰을 그대로 따른다 —
 * hex 를 박으면 디자인 규칙 위반이고 다크 대응도 끊긴다.
 */
function MyeongboSprite() {
  return (
    <svg
      data-myeongbo-sprite
      viewBox="0 0 8 8"
      className="h-1/2 w-1/2"
      fill="currentColor"
      shapeRendering="crispEdges"
    >
      {SPRITE.flatMap((row, y) =>
        [...row].map((cell, x) =>
          cell === "1" ? (
            <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />
          ) : null,
        ),
      )}
    </svg>
  );
}

function AssistantAvatar() {
  return (
    <span
      aria-hidden
      className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-line bg-chrome-graphite text-chrome-snow"
    >
      <MyeongboSprite />
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
  /** 폴러가 알려준 지금 하는 일. 서버가 문장으로 만들어 준다. */
  stage?: string | null;
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
  const endRef = useRef<HTMLDivElement | null>(null);

  // 새 메시지 추가 시 하단 자동 스크롤 (jsdom 환경에서 scrollIntoView 미구현 → guard)
  useEffect(() => {
    const el = endRef.current;
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  /** 도는 동안의 진행 문구만 바꾼다 — 답이 들어오기 전까지만 유효하다. */
  const setPendingNote = (note: string) => {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last && last.role === "assistant" && last.pending) {
        copy[copy.length - 1] = { ...last, pendingNote: note };
      }
      return copy;
    });
  };

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
  const sendToClaude = async (question: string, history: ChatMessage[]) => {
    const enq = await fetch("/api/assistant/claude", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question,
        // 이게 없으면 매 요청이 백지에서 시작해 "엔티티로 해주세요" 같은
        // 이어 말하기가 통하지 않는다. 몇 턴을 실을지는 서버가 자른다.
        history: history.map((h) => ({ role: h.role, content: h.content })),
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

    setPendingNote(STAGE_QUEUED);

    const startedAt = Date.now();
    for (;;) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const elapsed = Date.now() - startedAt;

      const res = await fetch(`/api/assistant/claude?id=${enqJson.id}`);
      const json = (await res.json()) as ClaudePoll;

      // 폴러가 알려준 실제 단계를 그대로 보여준다. 아직 안 왔으면 아는 사실만 말한다
      // — 예전엔 claim만 되면 "문서를 읽는 중"이라 했는데 안 읽고 있을 수도 있었다.
      setPendingNote(pendingNoteFor(json));

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
      // 오래 안 가져가면 알린다 — 다만 **여기서 멈추지 않는다.**
      //
      // 예전엔 이 자리에서 "회사 PC가 꺼졌다"고 단정하고 폴링을 끝냈다. 그런데
      // claim 이 27초 걸린 요청이 있었고(Vercel 응답 지연으로 폴러 요청이 한 번
      // 끊기고 재시도), 그 뒤 도착한 343자짜리 답이 통째로 사라졌다(2026-08-19).
      //
      // 안 가져갔다는 건 사실이지만 **꺼진 건지 늦는 건지는 화면이 알 수 없다.**
      // 그러니 사실만 말하고 기다리는 건 계속한다. 끝내는 건 3분 제한 하나뿐이다.
      if (json.status === "pending" && elapsed > UNCLAIMED_MS) {
        setPendingNote(STAGE_STILL_QUEUED);
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
      {
        role: "assistant",
        content: "",
        pending: true,
        pendingSince: Date.now(),
        ts: nowIso,
      },
    ]);
    setInput("");
    setPending(true);
    try {
      await sendToClaude(question, history);
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
      {/* 배경은 콘텐츠 표준 bg-paper(#ffffff). 이전엔 washi(#ede6d2)라 이 패널만
          화이트 리뉴얼 전 색으로 남아 있었다. */}
      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto bg-paper px-5 py-4">
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
        className="flex shrink-0 flex-col gap-2 border-t border-line-soft bg-paper px-5 py-3"
      >
        {/*
          칩은 인스펙터 표준(ScopeChips)을 따른다 — 테두리 상자가 아니라
          밑줄(vermilion) 텍스트. 좁은 패널에서 상자 두 개는 입력창보다 시끄럽다.
        */}
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
          {/* 첨부할 화면 정보가 없으면 칩도 그리지 않는다 — 켜도 아무 일이 안 일어난다. */}
          {pageContext && (
            <ModeChip
              active={attachPage}
              onClick={() => setAttachPage((v) => !v)}
              // 켜짐/꺼짐을 쓴다 — 이름만 있으면 지금 첨부되는지 알 수 없어
              // "이 기능이 작동하는 게 맞냐"는 물음이 나왔다.
              label={`${pageContext.label} 페이지 첨부 ${attachPage ? "켜짐" : "꺼짐"}`}
            />
          )}
          <span className="ml-auto pr-1 text-2xs text-muted">
            문서를 직접 읽습니다 · 30초쯤
          </span>
        </div>

        <textarea
          aria-label="질문 입력"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="무엇을 찾으시나요? Enter로 전송 · Shift+Enter 줄바꿈"
          rows={2}
          disabled={pending}
          maxLength={500}
          className="resize-none border border-line-soft bg-field-bg px-2.5 py-2 text-sm text-ink outline-none transition-colors focus:border-ink focus:bg-white"
        />

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={reset}
            disabled={pending || messages.length === 0}
            className="cursor-pointer bg-transparent px-1 py-1 text-xs text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            대화 초기화
          </button>
          <div className="flex items-center gap-2">
            {/* 글자수는 한계에 가까울 때만 — 평소엔 노이즈다 */}
            {input.length > 400 && (
              <span className="text-2xs text-muted">{input.length}/500</span>
            )}
            <button
              type="submit"
              disabled={pending || !input.trim()}
              className="cursor-pointer bg-ink px-4 py-1.5 text-sm font-medium text-cream transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "답변 중…" : "전송"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/** 인스펙터 표준 칩 — 테두리 없이 밑줄로 선택을 표시한다(ScopeChips와 동형). */
function ModeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`relative cursor-pointer border-none bg-transparent px-2 py-1 text-2xs transition-colors ${
        active ? "font-bold text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {label}
      {active && (
        <span
          aria-hidden
          className="absolute bottom-0.5 left-2 right-2 h-0.5 bg-vermilion"
        />
      )}
    </button>
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

  if (message.role === "user") {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-baseline gap-1.5 text-2xs text-muted">
          <span>{userName}</span>
          {message.ts && (
            <>
              <span aria-hidden>·</span>
              <span>{formatTimeKst(message.ts)}</span>
            </>
          )}
        </div>
        {/* 아바타 상자를 뺐다 — 460px 패널에서 44px를 먹는데 바로 위 이름표와 같은 말을 한다 */}
        <div className="max-w-[85%] bg-ink px-3.5 py-2 text-sm leading-relaxed text-cream">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // assistant — 답은 패널 폭을 다 쓴다. 아바타와 말풍선 테두리를 빼고 여백으로 나눈다.
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline gap-1.5 text-2xs">
        <span className="font-medium text-vermilion">{ASSISTANT_NAME}</span>
        {message.ts && (
          <>
            <span aria-hidden className="text-muted">
              ·
            </span>
            <span className="text-muted">{formatTimeKst(message.ts)}</span>
          </>
        )}
      </div>
      <div className="space-y-2.5">
        {message.pending ? (
          <PendingLine
            note={message.pendingNote ?? STAGE_QUEUED}
            since={message.pendingSince}
          />
        ) : (
          <>
            {/*
              지식망 페이지와 같은 react-markdown을 쓴다. 직전까지 손으로 짠 줄 단위
              렌더러라 불릿만 알았고, Claude가 잘 쓰는 제목·표가 날것으로 보였다.
              원시 HTML은 렌더하지 않는다(rehype-raw 미사용) — 답에 섞여도 실행 안 된다.
            */}
            <div className="chat-md text-sm leading-relaxed text-ink">
              <ReactMarkdown remarkPlugins={MARKDOWN_REMARK_PLUGINS}>
                {message.content}
              </ReactMarkdown>
            </div>
            {/*
              Claude 모드 근거 — 모델이 실제로 Read한 볼트 문서다. 제목이 아니라 경로가
              식별자라(원본이 파일) 열람 화면도 경로로 연다.
            */}
            {message.vaultSources && message.vaultSources.length > 0 && (
              <div className="space-y-1 border-t border-line-soft pt-2.5">
                <p className="text-2xs font-medium uppercase tracking-[0.12em] text-muted">
                  읽은 지식망 문서 {message.vaultSources.length}건
                </p>
                {/* 목록 항목형 — 인터랙션 표준(hover:bg-line-soft). 상자 대신 여백으로 나눈다 */}
                {message.vaultSources.map((path) => (
                  <Link
                    key={path}
                    href={`/dashboard/knowledge?doc=${encodeURIComponent(path)}`}
                    className="-mx-1.5 flex items-baseline gap-2 px-1.5 py-1 transition-colors hover:bg-line-soft"
                  >
                    <span className="shrink-0 text-2xs text-vermilion">지식망</span>
                    <span className="text-xs text-ink">
                      {path.replace(/\.md$/, "")}
                    </span>
                  </Link>
                ))}
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
        <AssistantAvatar />
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{ASSISTANT_NAME}</p>
          <p className="text-xs text-muted">운영부 상황실 · 조율</p>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-ink">{INTRO}</p>
      <p className="text-xs text-muted">이런 일을 시켜보세요</p>
      {/* 예시도 목록 항목형 — 상자 대신 호버(hover:bg-line-soft)로 누를 수 있음을 알린다 */}
      <ul className="-mx-1.5">
        {EXAMPLES.map((ex) => (
          <li key={ex}>
            <button
              type="button"
              onClick={() => onPick(ex)}
              className="w-full cursor-pointer bg-transparent px-1.5 py-1.5 text-left text-xs leading-relaxed text-ink transition-colors hover:bg-line-soft"
            >
              {ex}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
