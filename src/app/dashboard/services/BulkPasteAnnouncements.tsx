"use client";

import { useMemo, useState } from "react";
import { parsePastedAnnouncements } from "@/features/announcement-services/paste-parse";
import { upsertAnnouncementServicesBulk } from "@/features/announcement-services/actions";
import type { AnnouncementServiceInput } from "@/features/announcement-services/schemas";
import { ModalShell } from "@/components/common/ModalShell";

/**
 * 발표 서비스 일괄등록 — 연락처 일괄등록과 같은 붙여넣기 방식.
 *
 * 합격자통합관리시스템 자료는 '발표 회차' 단위라 같은 서비스가 여러 줄로 온다.
 * 파서가 서비스 단위로 합치고 오래된 건을 걸러내므로, 사용자는 시트를 통째로
 * 복사해 붙여넣기만 하면 된다.
 */
export function BulkPasteAnnouncements() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [upserted, setUpserted] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parsePastedAnnouncements(text), [text]);
  const validRows = parsed.rows.filter((r) => r.errors.length === 0);
  const errorRows = parsed.rows.filter((r) => r.errors.length > 0);

  function close() {
    setOpen(false);
    setText("");
    setUpserted(null);
    setError(null);
  }

  async function submit() {
    setPending(true);
    setError(null);
    const payload = validRows.map((r) => r.values as AnnouncementServiceInput);
    const res = await upsertAnnouncementServicesBulk(payload);
    setPending(false);
    if (res.ok) setUpserted(res.upserted);
    else setError(res.error ?? "등록 실패");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-pointer border border-line bg-transparent px-3 py-1 text-xs text-ink transition-colors hover:bg-washi"
      >
        + 발표 서비스 일괄등록
      </button>

      {open && (
        <ModalShell
          title="발표 서비스 일괄등록"
          onClose={close}
          size="xl"
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
            <p className="mb-1 text-xs leading-[1.6] text-ink">
              합격자통합관리시스템 발표 목록을 엑셀에서 표째(첫 행=열 이름)
              복사해 붙여넣으세요. 백업 요청의 서비스 검색에 함께 나옵니다.
            </p>
            <p className="mb-2 text-xs leading-[1.7] text-ink">
              필수 열) UnivServiceId · UnivName · ServiceName
              <br />
              <span className="text-muted">
                <span className="text-vermilion">※</span> 같은 서비스가 회차별로
                여러 줄이면 하나로 합칩니다. 발표일이 오래된 서비스는 검색이
                번잡해져 제외합니다.
              </span>
            </p>
            <textarea
              aria-label="발표 서비스 붙여넣기"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={
                "UnivId\tUnivName\tUnivServiceId\tServiceName\t발표제목\t발표시작일시(실제)\n..."
              }
              className="w-full border border-line-soft bg-field-bg px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
            />

            {parsed.headerError ? (
              <p className="mt-2 text-xs font-bold text-vermilion">
                {parsed.headerError}
              </p>
            ) : text.trim() !== "" ? (
              <div className="mt-2 text-xs text-ink-soft">
                <span className="text-ink">유효 {validRows.length}건</span>
                {parsed.duplicateCount > 0 && (
                  <span className="ml-2 text-muted">
                    회차 중복 {parsed.duplicateCount}줄 합침
                  </span>
                )}
                {parsed.staleCount > 0 && (
                  <span className="ml-2 text-muted">
                    오래된 발표 {parsed.staleCount}건 제외
                  </span>
                )}
                {errorRows.length > 0 && (
                  <span className="ml-2 text-vermilion">
                    오류 {errorRows.length}건
                  </span>
                )}
                {errorRows.length > 0 && (
                  <ul className="mt-1 max-h-24 overflow-y-auto">
                    {errorRows.slice(0, 20).map((r) => (
                      <li key={r.rowIndex} className="text-vermilion">
                        {r.rowIndex}행: {r.errors.join(", ")}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {upserted !== null && (
              <div className="mt-3 border border-line-soft bg-cream p-2 text-xs text-ink">
                {upserted}건 등록 완료. 서비스 검색에서 바로 찾을 수 있습니다.
              </div>
            )}
            {error && <p className="mt-2 text-xs text-vermilion">{error}</p>}
          </div>
        </ModalShell>
      )}
    </>
  );
}
