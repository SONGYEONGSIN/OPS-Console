"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { MARKDOWN_REMARK_PLUGINS } from "@/components/common/markdown-plugins";
import {
  requestFileDraft,
  requestTextDraft,
} from "@/features/knowledge/file-draft-actions";
import { getRunningFileDraft } from "@/features/knowledge/running-draft";
import type { DraftSource } from "@/features/knowledge/file-draft-shared";
import { pollAssistantRequest } from "@/features/assistant/poll-request";
import { STAGE_QUEUED } from "@/features/assistant/stage-label";
import { PendingLine } from "../../_components/assistant-launcher/PendingLine";

/**
 * 가진 재료로 지식망 초안 만들기.
 *
 * 재료가 세 가지다. **링크**(Teams·SharePoint 에 이미 올라간 것), **파일**(내 PC 에
 * 있는 것), **본문**(메일·회의에서 오간 말처럼 파일이 아예 없는 것). 링크 하나만
 * 받던 때는 앞의 하나가 아니면 길이 없었다.
 *
 * 올린 파일은 **링크로 바꿔 같은 길로 보낸다** — 서버가 SharePoint 에 올리고
 * 그 주소를 주면 그 뒤는 링크를 붙여넣었을 때와 완전히 같다. 읽는 경로를 두 벌로
 * 만들지 않는다.
 *
 * **답이 돌아오는 자리가 여기다.** 요청만 넣고 끝내면 에이전트의 되묻기가 아무도
 * 안 보는 DB 행에 갇힌다(2026-08-25 취업규칙 33쪽). 탭이 URL 이라 다른 탭에
 * 다녀오면 이 컴포넌트가 죽으므로, 돌아왔을 때 도는 중이던 요청을 이어받는다.
 */

type Turn = { role: "user" | "assistant"; content: string };

const SOURCES: { key: DraftSource; label: string }[] = [
  { key: "link", label: "링크" },
  { key: "file", label: "파일 올리기" },
  { key: "text", label: "직접 입력" },
];

const FIELD_CLASS =
  "w-full border border-line-soft bg-field-bg px-2 py-1 text-ink outline-none transition-colors focus:border-ink focus:bg-white";

export function FileDraftForm() {
  const [source, setSource] = useState<DraftSource>("link");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  /**
   * 요청부터 답까지 도는 중.
   *
   * `useTransition` 을 쓰지 않는다 — 이 흐름은 최대 3분이고 await 를 여러 번
   * 건너는데, 트랜지션의 pending 은 그 스코프에서 제때 안 풀려 답이 온 뒤에도
   * '보내기'가 계속 잠겨 있었다.
   */
  const [busy, setBusy] = useState(false);
  /** 큐에 들어가기 전에 거부된 사유(링크 형식·권한·업로드 실패). */
  const [error, setError] = useState<string | null>(null);
  /** 도는 중이면 지금 하는 일, 아니면 null. */
  const [stage, setStage] = useState<string | null>(null);
  const [since, setSince] = useState<number | undefined>(undefined);
  /** 주고받은 것 — 되묻기에 답하려면 앞 턴이 함께 가야 한다. */
  const [turns, setTurns] = useState<Turn[]>([]);
  const [reply, setReply] = useState("");
  /** 끝났지만 답이 아닌 것(시간 초과·실행 실패). 답 자리에 대신 놓는다. */
  const [ended, setEnded] = useState<string | null>(null);

  /** 큐에 들어간 뒤부터는 어느 재료로 왔든 같다 — 지켜보고, 온 것을 그 자리에 놓는다. */
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

  // 다른 탭에 다녀오면 이 컴포넌트가 죽는다. 도는 중이던 요청을 이어받지 않으면
  // 답이 사라져, 되묻기를 아무도 못 보던 문제가 그대로 재발한다.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await getRunningFileDraft();
      if (!alive || !r) return;
      setBusy(true);
      try {
        await watch(r.id, [{ role: "user", content: r.question }]);
      } finally {
        setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
    // 마운트에 한 번만 — 도는 중인 것을 붙잡는 게 목적이다.
     
  }, []);

  /** 올린 파일을 SharePoint 주소로 바꿔 준다. 실패하면 사유를 그대로 올린다. */
  const uploadToLink = async (f: File): Promise<string | null> => {
    const form = new FormData();
    form.set("file", f);
    const res = await fetch("/api/knowledge/upload", {
      method: "POST",
      body: form,
    });
    const json = (await res.json()) as {
      ok: boolean;
      webUrl?: string;
      error?: string;
    };
    if (!json.ok || !json.webUrl) {
      setError(json.error ?? "업로드에 실패했습니다");
      return null;
    }
    return json.webUrl;
  };

  const canSubmit =
    source === "link" ? !!url.trim() : source === "text" ? !!text.trim() : !!file;

  const submit = () => {
    setError(null);
    setEnded(null);
    setTurns([]);
    void (async () => {
      setBusy(true);
      try {
        if (source === "text") {
          const r = await requestTextDraft(text, note);
          if (!r.ok) {
            setError(r.error);
            return;
          }
          setText("");
          setNote("");
          await watch(r.id, [{ role: "user", content: r.question }]);
          return;
        }

        // 파일은 올려서 링크로 바꾼 뒤, 링크와 완전히 같은 길로 간다.
        let link = url;
        if (source === "file") {
          if (!file) return;
          setStage(`파일을 올리는 중 — ${file.name}`);
          setSince(Date.now());
          const uploaded = await uploadToLink(file);
          setStage(null);
          if (!uploaded) return;
          link = uploaded;
        }

        const r = await requestFileDraft(link, note);
        if (!r.ok) {
          // 고쳐서 다시 눌러야 하므로 링크는 그대로 둔다.
          setError(r.error);
          return;
        }
        // 같은 것을 두 번 넣기 쉬워 비운다.
        setUrl("");
        setNote("");
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
        await watch(r.id, [{ role: "user", content: r.question }]);
      } finally {
        setBusy(false);
      }
    })();
  };

  const sendReply = () => {
    const body = reply.trim();
    if (!body) return;
    setReply("");
    setEnded(null);
    const asked: Turn[] = [...turns, { role: "user", content: body }];
    void (async () => {
      setBusy(true);
      try {
        // 되묻기에 답하는 것은 평범한 후속 질문이라 어시스턴트 창구를 그대로 쓴다.
        const res = await fetch("/api/assistant/claude", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question: body,
            history: turns.map((t) => ({ role: t.role, content: t.content })),
            pageContext: "지식망 — 파일로 초안",
          }),
        });
        const json = (await res.json()) as {
          ok: boolean;
          id?: string;
          error?: string;
        };
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

  const answer =
    turns.at(-1)?.role === "assistant" ? turns.at(-1)!.content : null;

  return (
    <section className="border border-line-soft bg-situation-bg p-4">
      <h3 className="text-sm font-bold text-ink">초안 만들기</h3>
      <p className="mt-1 text-2xs text-muted">
        가진 재료로 읽고 정리해 <code className="font-mono">제안/</code> 에 초안을
        만듭니다. 본 위치로 옮기는 것은 사람이 확인한 뒤입니다.
      </p>

      <div role="tablist" className="mt-3 flex gap-1 border-b border-line-soft">
        {SOURCES.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={source === s.key}
            onClick={() => {
              setSource(s.key);
              setError(null);
            }}
            className={`-mb-px cursor-pointer px-3 py-1.5 text-xs transition-colors ${
              source === s.key
                ? "border-b-2 border-vermilion font-semibold text-vermilion"
                : "border-b-2 border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {source === "link" && (
        <label className="mt-3 block text-xs">
          <span className="mb-1 block text-muted">파일 링크</span>
          <input
            aria-label="파일 링크"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Teams 에서 '링크 복사' 한 주소"
            className={FIELD_CLASS}
          />
          <span className="mt-1 block text-2xs text-muted">
            Teams·SharePoint 의 Word·PPT·Excel·PDF
          </span>
        </label>
      )}

      {source === "file" && (
        <label className="mt-3 block text-xs">
          <span className="mb-1 block text-muted">올릴 파일</span>
          <input
            aria-label="올릴 파일"
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.rtf,.odt,.ods,.odp,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className={`${FIELD_CLASS} file:mr-2 file:cursor-pointer file:border-0 file:bg-transparent file:text-ink`}
          />
          <span className="mt-1 block text-2xs text-muted">
            40MB 까지. 올린 파일은 팀 SharePoint 에 남아 초안의 근거가 됩니다.
          </span>
        </label>
      )}

      {source === "text" && (
        <label className="mt-3 block text-xs">
          <span className="mb-1 block text-muted">정리할 내용</span>
          <textarea
            aria-label="정리할 내용"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="메일 본문이나 회의에서 오간 내용을 그대로 붙여넣으세요"
            className={`${FIELD_CLASS} resize-y`}
          />
        </label>
      )}

      <label className="mt-2 block text-xs">
        <span className="mb-1 block text-muted">
          무엇을 정리할지 (비우면 전체 요점)
        </span>
        <input
          aria-label="무엇을 정리할지"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="예: 수수료 정산 규칙만"
          className={FIELD_CLASS}
        />
      </label>

      <button
        type="button"
        disabled={busy || !canSubmit}
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
              placeholder="예: 1안, 규칙으로"
              className={`${FIELD_CLASS} resize-y`}
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
