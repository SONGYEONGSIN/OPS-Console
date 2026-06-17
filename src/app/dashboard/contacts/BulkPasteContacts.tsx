"use client";

import { useMemo, useState } from "react";
import {
  parsePastedContacts,
  toContactCreate,
} from "@/features/contacts/paste-parse";
import { createContactsBulk } from "@/features/contacts/actions";
import { ModalShell } from "@/components/common/ModalShell";

type RunResult = {
  inserted: number;
  duplicates: { university_name: string; customer_name: string }[];
};

export function BulkPasteContacts() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parsePastedContacts(text), [text]);
  const validRows = parsed.rows.filter((r) => r.errors.length === 0);
  const errorRows = parsed.rows.filter((r) => r.errors.length > 0);

  function close() {
    setOpen(false);
    setText("");
    setResult(null);
    setError(null);
  }

  async function submit() {
    setPending(true);
    setError(null);
    const payload = validRows.map((r) => toContactCreate(r.values));
    const res = await createContactsBulk(payload);
    setPending(false);
    if (res.ok) {
      setResult({ inserted: res.inserted, duplicates: res.duplicates });
    } else {
      setError(res.error ?? "등록 실패");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer border border-ink bg-ink px-3 py-1 text-xs font-medium text-cream transition-colors hover:bg-vermilion"
      >
        + 연락처 일괄등록
      </button>

      {open && (
        <ModalShell
          title="연락처 일괄등록"
          onClose={close}
          size="lg"
          footer={
            <>
              <button
                type="button"
                onClick={close}
                className="cursor-pointer border border-line bg-transparent px-3 py-1 text-xs text-ink hover:bg-washi"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending || validRows.length === 0}
                className="cursor-pointer border border-ink bg-ink px-4 py-1 text-xs font-medium text-cream transition-colors hover:bg-vermilion disabled:cursor-not-allowed disabled:text-cream/70"
              >
                {pending ? "등록 중…" : "등록"}
              </button>
            </>
          }
        >
          <div>
              <p className="mb-1 text-xs leading-[1.6] text-muted">
                엑셀에서 표(첫 행=열 이름)를 복사해 붙여넣으세요.
                대학명·고객명은 필수입니다. (이메일/전화/내선/직위/부서 등 열
                이름 자동 인식)
              </p>
              <p className="mb-2 text-xs leading-[1.7] text-ink-soft">
                예시) 대학명 · 고객명 · 이메일 · 전화 (첫 행은 열 이름)
                <br />
                서강대 · 김담당 · kim@sg.ac.kr · 02-705-1234
                <br />
                <span className="text-muted">
                  구분자: 탭(엑셀 복사) · 가운뎃점(·) · 쉼표 모두 인식
                </span>
              </p>
              <textarea
                aria-label="연락처 붙여넣기"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder={"대학명\t고객명\t이메일\t전화\n..."}
                className="w-full border border-line bg-cream px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
              />

              {parsed.headerError ? (
                <p className="mt-2 text-xs text-vermilion">
                  {parsed.headerError}
                </p>
              ) : text.trim() !== "" ? (
                <div className="mt-2 text-xs text-ink-soft">
                  <span className="text-ink">유효 {validRows.length}건</span>
                  {errorRows.length > 0 && (
                    <span className="ml-2 text-vermilion">
                      오류 {errorRows.length}건
                    </span>
                  )}
                  {parsed.unmappedHeaders.length > 0 && (
                    <span className="ml-2 text-muted">
                      (무시된 열: {parsed.unmappedHeaders.join(", ")})
                    </span>
                  )}
                  {errorRows.length > 0 && (
                    <ul className="mt-1 max-h-24 overflow-y-auto">
                      {errorRows.map((r) => (
                        <li key={r.rowIndex} className="text-vermilion">
                          {r.rowIndex}행: {r.errors.join(", ")}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              {result && (
                <div className="mt-3 border border-line-soft bg-cream p-2 text-xs text-ink">
                  <div>{result.inserted}건 등록 완료.</div>
                  {result.duplicates.length > 0 && (
                    <div className="mt-1 text-ink-soft">
                      중복 {result.duplicates.length}건 제외:{" "}
                      {result.duplicates
                        .map((d) => `${d.university_name}—${d.customer_name}`)
                        .join(", ")}
                    </div>
                  )}
                </div>
              )}
              {error && <p className="mt-2 text-xs text-vermilion">{error}</p>}
          </div>
        </ModalShell>
      )}
    </>
  );
}
