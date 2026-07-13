"use client";

import { useEffect, useRef, useState, type SetStateAction } from "react";
import Link from "next/link";
import type { ListRow } from "@/app/dashboard/_components/patterns/ListPattern";
import { HandoverCategoryFields } from "@/app/dashboard/_components/inspector/list-variants/handover/HandoverCategoryFields";
import { CopySection } from "@/app/dashboard/_components/inspector/list-variants/handover/CopySection";
import { buildHandoverUpsertInput } from "@/app/dashboard/_components/inspector/list-variants/handover/upsert-input";
import { upsertHandoverRecord } from "@/features/handover/actions";
import {
  HANDOVER_CATEGORIES,
  type HandoverCategoryKey,
} from "@/features/handover/categories";
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

  const activeCategory =
    HANDOVER_CATEGORIES.find((c) => c.key === active) ?? HANDOVER_CATEGORIES[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex w-full items-center justify-between gap-3">
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

      {/* 운영가이드 레이아웃 — 제목 헤더 + 좌 nav / 우 패널 grid (박스 시트 제거) */}
      <header className="mb-4 shrink-0">
        <h2 className="truncate text-xl font-bold text-ink">
          {row.applicationType ? (
            <span className="mr-1.5">{row.applicationType}</span>
          ) : null}
          {row.universityName ?? "—"}
          <span className="text-muted"> · </span>
          {row.serviceName ?? "—"}
        </h2>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
        <HandoverCategoryRail
          row={row}
          active={active}
          onChange={(key) => setActive(key)}
        />
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pb-14 pr-4">
          {/* 패널 헤더 — 운영가이드 우측 패널(OpsGuidePanel) 톤 */}
          <header>
            <h3 className="text-xl font-semibold tracking-[-0.02em]">
              {activeCategory.label}
            </h3>
            <p className="mt-1 text-xs text-muted">
              {activeCategory.fields.map((f) => f.label).join(" · ")}
            </p>
          </header>
          <HandoverCategoryFields
            row={row}
            setRow={setRow}
            category={active}
            contractsStatusOptions={contractsStatusOptions}
          />
        </div>
      </div>
    </div>
  );
}
