"use client";

import { useEffect, useRef, useState } from "react";
import { CopySection } from "@/app/dashboard/_components/inspector/list-variants/handover/CopySection";
import { copyHandoverRecord } from "@/features/handover/actions";
import type { EditFormProps } from "@/app/dashboard/_components/inspector/list-variants/types";

type Candidates = NonNullable<EditFormProps["handoverServiceCandidates"]>;

/**
 * 인수인계 작성 탭 목록 — 제목줄 우측 '복제' 버튼.
 * 드롭다운에서 ①원본 서비스(작성완료만) 검색·선택 → ②대상 선택(CopySection) 순.
 * 편집기에 있던 복제 기능을 목록으로 이동한 것 (드롭다운 톤 동일).
 */
export function HandoverListCopy({ candidates }: { candidates: Candidates }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [source, setSource] = useState<Candidates[number] | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const term = q.trim();
  const sources = term
    ? candidates
        .filter((c) => c.hasRecord)
        .filter(
          (c) =>
            c.universityName.includes(term) ||
            c.serviceName.includes(term) ||
            String(c.serviceId).includes(term),
        )
        .slice(0, 12)
    : [];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="border border-vermilion bg-vermilion px-3 py-1 text-sm text-cream transition-colors hover:opacity-90"
      >
        복제
      </button>
      {open ? (
        // 배경·섀도우는 알림(AlertsBell) 드롭다운과 동일 톤
        <div className="absolute right-0 z-20 mt-1 w-80 border border-chrome-graphite bg-paper p-3 [box-shadow:4px_6px_0_rgba(21,18,12,0.15)]">
          {source === null ? (
            <div className="space-y-2">
              <p className="text-2xs uppercase tracking-[0.18em] text-muted">
                원본 서비스 선택
              </p>
              <p className="text-2xs text-muted">
                작성완료된 서비스의 내용을 복제합니다.
              </p>
              <input
                aria-label="복제 원본 서비스 검색"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="대학명 · 서비스명 · service_id 검색"
                className="w-full border border-line-soft bg-search-field-bg px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
              />
              {term && sources.length === 0 ? (
                <p className="text-2xs text-muted">
                  작성완료된 서비스 중 검색 결과 없음
                </p>
              ) : null}
              {sources.length > 0 ? (
                <ul className="max-h-48 space-y-0.5 overflow-y-auto border border-line-soft p-1">
                  {sources.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSource(c)}
                        className="block w-full cursor-pointer border-none bg-transparent px-2 py-1 text-left text-xs text-ink hover:bg-line-soft"
                      >
                        {c.universityName} · {c.serviceName}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="flex items-center justify-between gap-2 border-b border-line-soft pb-2 text-xs font-bold text-ink">
                <span className="truncate">
                  {source.universityName}
                  <span className="text-muted"> · </span>
                  {source.serviceName}
                </span>
                <button
                  type="button"
                  onClick={() => setSource(null)}
                  className="shrink-0 cursor-pointer border border-line bg-white px-2 py-0.5 text-2xs text-ink transition-colors hover:border-vermilion hover:bg-vermilion hover:text-cream"
                >
                  원본 변경
                </button>
              </p>
              <CopySection
                fromServiceId={source.id}
                candidates={candidates}
                onCopy={copyHandoverRecord}
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
