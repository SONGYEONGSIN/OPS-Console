"use client";

import { useState, useTransition } from "react";
import { requestFileDraft } from "@/features/knowledge/file-draft-actions";

/**
 * Teams·SharePoint 파일로 지식망 초안 만들기.
 *
 * 파일 탐색 화면을 따로 두지 않고 **링크를 붙여넣게** 한다 — 채널 파일·채팅 파일·
 * 내 OneDrive 가 각각 다른 곳에 있어서, 어느 하나를 고르는 화면을 만들면 나머지는
 * 못 넣는다. Teams 에서 '링크 복사' 한 걸 그대로 받으면 전부 된다.
 *
 * 답은 30~40초 뒤 `제안/` 에 초안으로 온다. 여기서는 요청만 넣는다.
 */
export function FileDraftForm() {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  const submit = () => {
    setMessage(null);
    startTransition(async () => {
      const r = await requestFileDraft(url, note);
      if (r.ok) {
        setMessage({
          kind: "ok",
          text: "요청했습니다. 30초쯤 뒤 제안/ 에 초안이 생깁니다.",
        });
        // 같은 파일을 두 번 넣기 쉬워 비운다. 실패했을 때는 고쳐서 다시
        // 눌러야 하므로 그대로 둔다.
        setUrl("");
        setNote("");
      } else {
        setMessage({ kind: "error", text: r.error });
      }
    });
  };

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
        disabled={pending || !url.trim()}
        onClick={submit}
        className="mt-3 cursor-pointer border border-line-soft px-2.5 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "요청 중" : "초안 요청"}
      </button>

      {message && (
        <p
          className={`mt-2 text-2xs ${
            message.kind === "error" ? "text-vermilion" : "text-muted"
          }`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
