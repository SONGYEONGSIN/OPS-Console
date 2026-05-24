"use client";

import { useEffect } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import { OPERATORS } from "@/features/auth/operators";
import { postStatusKeys, postStatusLabel } from "./Table";

type Props = {
  row: ListRow;
  variant: "post-feedback" | "post-notice";
  setRow: (next: ListRow) => void;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
  /** post-feedback/post-notice: 등록자를 본인 계정으로 고정 표시. */
  currentUserName?: string;
};

export function PostForm({
  row,
  variant,
  setRow,
  onSave,
  onCancel,
  currentUserName,
}: Props) {
  const lockAuthor = !!currentUserName;
  // post 작성 시 등록자를 본인으로 자동 채움 (서버 단도 author_email은
  // operator.email로 강제). select가 빈 값으로 노출되는 어색함 해소.
  useEffect(() => {
    if (lockAuthor && row.author !== currentUserName) {
      setRow({ ...row, author: currentUserName });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockAuthor, currentUserName]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">제목</span>
        <input
          aria-label="제목"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="제목을 입력해주세요"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">내용</span>
        <textarea
          aria-label="내용"
          value={row.body ?? ""}
          onChange={(e) => setRow({ ...row, body: e.target.value })}
          rows={8}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="본문을 작성해주세요"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">등록자</span>
        {lockAuthor ? (
          <span
            aria-label="등록자"
            data-locked-author="true"
            className="block w-full border border-line bg-washi px-2 py-1 text-ink"
          >
            {currentUserName}
          </span>
        ) : (
          <select
            aria-label="등록자"
            value={row.author ?? ""}
            onChange={(e) => setRow({ ...row, author: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="">선택…</option>
            {(variant === "post-notice"
              ? OPERATORS.filter((o) => o.role === "부장" || o.role === "팀장")
              : OPERATORS
            ).map((op) => (
              <option key={op.email} value={op.name}>
                {op.name} · {op.role}
              </option>
            ))}
          </select>
        )}
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">상태</span>
        <select
          aria-label="상태"
          value={row.status}
          onChange={(e) =>
            setRow({ ...row, status: e.target.value as ListRow["status"] })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          {postStatusKeys(variant).map((s) => (
            <option key={s} value={s}>
              {postStatusLabel(variant, s)}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
      {row.id !== "" && (
        <div className="border-t border-line-soft pt-3">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm("이 글을 삭제하시겠습니까? 되돌릴 수 없습니다.")
              ) {
                onSave({ ...row, status: "deleted" });
              }
            }}
            className="w-full border border-vermilion-deep bg-transparent px-3 py-1.5 text-sm text-vermilion-deep hover:bg-vermilion-deep hover:text-cream"
          >
            삭제
          </button>
        </div>
      )}
    </form>
  );
}
