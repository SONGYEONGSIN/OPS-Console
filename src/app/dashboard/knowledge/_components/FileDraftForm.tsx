"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { MARKDOWN_REMARK_PLUGINS } from "@/components/common/markdown-plugins";
import { requestFileDraft } from "@/features/knowledge/file-draft-actions";
import { pollAssistantRequest } from "@/features/assistant/poll-request";
import { STAGE_QUEUED } from "@/features/assistant/stage-label";
import { PendingLine } from "../../_components/assistant-launcher/PendingLine";

/**
 * Teams·SharePoint 파일로 지식망 초안 만들기.
 *
 * 파일 탐색 화면을 따로 두지 않고 **링크를 붙여넣게** 한다 — 채널 파일·채팅 파일·
 * 내 OneDrive 가 각각 다른 곳에 있어서, 어느 하나를 고르는 화면을 만들면 나머지는
 * 못 넣는다. Teams 에서 '링크 복사' 한 걸 그대로 받으면 전부 된다.
 *
 * **답이 돌아오는 자리가 여기다.** 예전에는 요청만 넣고 "30초쯤 뒤 제안/ 에 초안이
 * 생깁니다"를 띄운 뒤 끝냈다. 그런데 에이전트는 초안을 못 쓰겠으면 **되묻는다** —
 * 33쪽짜리 취업규칙에 "연도별 값을 넣을까요, 어느 칸에 넣을까요"를 물었고, 그 말이
 * 아무도 안 보는 DB 행에 갇혀 초안 없이 끝났다(2026-08-25). 되묻기는 좋은 질문이라
 * 막을 게 아니라, 답할 자리를 주는 게 맞다.
 */

type Turn = { role: "user" | "assistant"; content: string };

export function FileDraftForm() {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  /**
   * 요청부터 답까지 도는 중.
   *
   * `useTransition` 을 쓰지 않는다 — 이 흐름은 최대 3분이고 await 를 여러 번
   * 건너는데, 트랜지션의 pending 은 그 스코프에서 제때 안 풀려 답이 온 뒤에도
   * '보내기'가 계속 잠겨 있었다.
   */
  const [busy, setBusy] = useState(false);
  /** 적재 자체가 거부된 사유(링크 형식·권한). 큐에 들어가기 전 이야기다. */
  const [error, setError] = useState<string | null>(null);

  /** 도는 중이면 지금 하는 일, 아니면 null. */
  const [stage, setStage] = useState<string | null>(null);
  const [since, setSince] = useState<number | undefined>(undefined);
  /** 주고받은 것 — 되묻기에 답하려면 앞 턴이 함께 가야 한다. */
  const [turns, setTurns] = useState<Turn[]>([]);
  const [reply, setReply] = useState("");
  /** 끝났지만 답이 아닌 것(시간 초과·실행 실패). 답 자리에 대신 놓는다. */
  const [ended, setEnded] = useState<string | null>(null);

  /** 큐에 들어간 뒤부터는 어느 경로든 같다 — 지켜보고, 온 것을 그 자리에 놓는다. */
  const watch = async (id: string, asked: Turn[]) => {
    setSince(Date.now());
    setStage(STAGE_QUEUED);
    const outcome = await pollAssistantRequest(id, setStage);
    setStage(null);
    if (outcome.kind === "done") {
      setTurns([...asked, { role: "assistant", content: outcome.answer }]);
      return;
    }
    setEnded(
      outcome.kind === "failed"
        ? `실행에 실패했습니다 — ${outcome.message}`
        : "3분이 지나 기다리기를 멈췄습니다. 회사 PC 폴러가 도는지 확인해 주세요.",
    );
  };

  const submit = () => {
    setError(null);
    setEnded(null);
    setTurns([]);
    void (async () => {
      setBusy(true);
      try {
        const r = await requestFileDraft(url, note);
        if (!r.ok) {
          // 고쳐서 다시 눌러야 하므로 링크는 그대로 둔다.
          setError(r.error);
          return;
        }
        // 같은 파일을 두 번 넣기 쉬워 비운다.
        setUrl("");
        setNote("");
        await watch(r.id, [{ role: "user", content: r.question }]);
      } finally {
        setBusy(false);
      }
    })();
  };

  const sendReply = () => {
    const text = reply.trim();
    if (!text) return;
    setReply("");
    setEnded(null);
    const asked: Turn[] = [...turns, { role: "user", content: text }];
    void (async () => {
      setBusy(true);
      try {
        // 되묻기에 답하는 것은 평범한 후속 질문이라 어시스턴트 창구를 그대로 쓴다.
        const res = await fetch("/api/assistant/claude", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question: text,
            history: turns.map((t) => ({ role: t.role, content: t.content })),
            pageContext: "지식망 — 파일로 초안",
          }),
        });
        const json = (await res.json()) as { ok: boolean; id?: string; error?: string };
        if (!json.ok || !json.id) {
          setError(json.error ?? "요청 적재 실패");
          return;
        }
        setTurns(asked);
        await watch(json.id, asked);
      } finally {
        setBusy(false);
      }
    })();
  };

  const answer = turns.at(-1)?.role === "assistant" ? turns.at(-1)!.content : null;

  return (
    <section className="border border-line-soft bg-situation-bg p-4">
      <h3 className="text-sm font-bold text-ink">파일로 초안 만들기</h3>
      <p className="mt-1 text-2xs text-muted">
        Teams·SharePoint 의 Word·PPT·Excel·PDF 링크를 붙여넣으면 읽고 정리해{" "}
        <code className="font-mono">제안/</code> 에 초안을 만듭니다. 본 위치로
        옮기는 것은 사람이 확인한 뒤입니다.
      </p>

      <label className="mt-3 block text-xs">
        <span className="mb-1 block text-muted">파일 링크</span>
        <input
          aria-label="파일 링크"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Teams 에서 '링크 복사' 한 주소"
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink outline-none transition-colors focus:border-ink focus:bg-white"
        />
      </label>

      <label className="mt-2 block text-xs">
        <span className="mb-1 block text-muted">
          무엇을 정리할지 (비우면 문서 전체 요점)
        </span>
        <input
          aria-label="무엇을 정리할지"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="예: 수수료 정산 규칙만"
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink outline-none transition-colors focus:border-ink focus:bg-white"
        />
      </label>

      <button
        type="button"
        disabled={busy || !url.trim()}
        onClick={submit}
        className="mt-3 cursor-pointer border border-line-soft px-2.5 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "요청 중" : "초안 요청"}
      </button>

      {error && <p className="mt-2 text-2xs text-vermilion">{error}</p>}

      {stage && (
        <div className="mt-3 border-t border-line-soft pt-3">
          <PendingLine note={stage} since={since} />
        </div>
      )}

      {ended && !stage && (
        <p className="mt-3 border-t border-line-soft pt-3 text-xs text-vermilion">
          {ended}
        </p>
      )}

      {answer && !stage && (
        <div className="mt-3 border-t border-line-soft pt-3">
          <div className="prose-ops text-xs text-ink">
            <ReactMarkdown remarkPlugins={MARKDOWN_REMARK_PLUGINS}>
              {answer}
            </ReactMarkdown>
          </div>

          {/* 되묻기에 답하는 자리. 이게 없으면 좋은 질문이 막다른 길이 된다. */}
          <label className="mt-3 block text-xs">
            <span className="mb-1 block text-muted">답하기</span>
            <textarea
              aria-label="답하기"
              rows={2}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder='예: 1안, 규칙으로'
              className="w-full resize-y border border-line-soft bg-field-bg px-2 py-1 text-ink outline-none transition-colors focus:border-ink focus:bg-white"
            />
          </label>
          <button
            type="button"
            disabled={busy || !reply.trim()}
            onClick={sendReply}
            className="mt-2 cursor-pointer border border-line-soft px-2.5 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
          >
            보내기
          </button>
        </div>
      )}
    </section>
  );
}
