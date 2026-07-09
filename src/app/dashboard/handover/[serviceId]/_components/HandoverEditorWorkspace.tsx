"use client";

import { useEffect, useRef, useState, type SetStateAction } from "react";
import Link from "next/link";
import type { ListRow } from "@/app/dashboard/_components/patterns/ListPattern";
import { HandoverCategoryFields } from "@/app/dashboard/_components/inspector/list-variants/handover/HandoverCategoryFields";
import { CopySection } from "@/app/dashboard/_components/inspector/list-variants/handover/CopySection";
import { buildHandoverUpsertInput } from "@/app/dashboard/_components/inspector/list-variants/handover/upsert-input";
import { upsertHandoverRecord } from "@/features/handover/actions";
import { type HandoverCategoryKey } from "@/features/handover/categories";
import type { EditFormProps } from "@/app/dashboard/_components/inspector/list-variants/types";
import { HandoverCategoryRail } from "./HandoverCategoryRail";

export function HandoverEditorWorkspace({
  initialRow,
  contractsStatusOptions,
  handoverServiceCandidates,
  onCopyHandover,
}: {
  initialRow: ListRow;
  contractsStatusOptions: string[];
  handoverServiceCandidates: EditFormProps["handoverServiceCandidates"];
  onCopyHandover: EditFormProps["onCopyHandover"];
}) {
  const [row, setRowState] = useState<ListRow>(initialRow);
  // 최신 row를 동기 추적 — setRow가 state updater 밖에서 next를 계산하도록.
  const rowRef = useRef<ListRow>(initialRow);
  const [active, setActive] = useState<HandoverCategoryKey>("contract");
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 복제 드롭다운 — 상단 우측 '복제' 버튼으로 토글, 바깥 클릭 시 닫힘.
  const [copyOpen, setCopyOpen] = useState(false);
  const copyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!copyOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (copyRef.current && !copyRef.current.contains(e.target as Node)) {
        setCopyOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [copyOpen]);

  function scheduleSave(next: ListRow) {
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await upsertHandoverRecord(buildHandoverUpsertInput(next));
      setSaved(res.ok);
    }, 800);
  }

  // 사이드이펙트(자동저장 스케줄)는 state updater 밖에서 — updater는 순수하게 유지.
  // rowRef로 최신값을 동기 추적하므로 연속 입력도 누적 후 한 번만 저장된다.
  function setRow(updater: SetStateAction<ListRow>) {
    const next =
      typeof updater === "function"
        ? (updater as (p: ListRow) => ListRow)(rowRef.current)
        : updater;
    rowRef.current = next;
    setRowState(next);
    scheduleSave(next);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 툴바도 시트와 같은 폭으로 정렬 (max-w-5xl) */}
      <div className="mx-auto mb-3 flex w-full max-w-5xl items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard/handover"
            className="inline-flex shrink-0 items-center border border-line px-3 py-1 text-sm text-ink transition-colors hover:bg-ink hover:text-cream"
          >
            ← 목록 이동
          </Link>
        </div>
        <div className="flex flex-none items-center gap-3">
          <span className="text-xs font-bold text-muted">
            {saved ? "✓ 자동 저장됨" : "저장 중…"}
          </span>
          {onCopyHandover ? (
            <div className="relative" ref={copyRef}>
              <button
                type="button"
                aria-expanded={copyOpen}
                onClick={() => setCopyOpen((v) => !v)}
                className="border border-ink bg-transparent px-3 py-1 text-sm text-ink transition-colors hover:border-vermilion hover:bg-vermilion hover:text-cream"
              >
                복제
              </button>
              {copyOpen ? (
                // 배경·섀도우는 알림(AlertsBell) 드롭다운과 동일 톤
                <div className="absolute right-0 z-20 mt-1 w-80 border border-chrome-graphite bg-paper p-3 [box-shadow:4px_6px_0_rgba(21,18,12,0.15)]">
                  <p className="mb-2 truncate border-b border-line-soft pb-2 text-xs font-bold text-ink">
                    {row.applicationType ? (
                      <span className="mr-1">{row.applicationType}</span>
                    ) : null}
                    {row.universityName ?? "—"}
                    <span className="text-muted"> · </span>
                    {row.serviceName ?? "—"}
                  </p>
                  <CopySection
                    fromServiceId={row.id}
                    candidates={handoverServiceCandidates ?? []}
                    onCopy={onCopyHandover}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <Link
            href="/dashboard/handover?tab=progress"
            className="border border-ink bg-transparent px-3 py-1 text-sm text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
          >
            인수인계 진행 이동 →
          </Link>
        </div>
      </div>

      {/* 문서 제목 + 카테고리 rail + 본문을 한 장의 흰 시트로. 바깥은 bg-paper 상속.
          스크롤은 본문에만 — 제목과 rail은 항상 보인다. w-full로 좁은 화면 축소 허용 */}
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col border border-line bg-white shadow-offset">
        {/* 문서 제목 (masthead) — 접수구분 · 대학명 · 서비스명 */}
        <p className="shrink-0 truncate border-b border-line px-6 py-3.5 text-base font-bold text-ink">
          {row.applicationType ? (
            <span className="mr-1.5">{row.applicationType}</span>
          ) : null}
          {row.universityName ?? "—"}
          <span className="text-muted"> · </span>
          {row.serviceName ?? "—"}
        </p>

        <div className="flex min-h-0 flex-1">
          <HandoverCategoryRail
            row={row}
            active={active}
            onChange={(key) => setActive(key)}
          />
          {/* px-10 pt-8 pb-14 = meeting-form.css .sheet padding (34px 40px 60px) */}
          <div className="min-h-0 flex-1 overflow-y-auto px-10 pt-8 pb-14">
            <HandoverCategoryFields
              row={row}
              setRow={setRow}
              category={active}
              contractsStatusOptions={contractsStatusOptions}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
