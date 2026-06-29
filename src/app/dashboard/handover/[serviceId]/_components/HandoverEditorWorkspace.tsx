"use client";

import { useEffect, useRef, useState, type SetStateAction } from "react";
import Link from "next/link";
import type { ListRow } from "@/app/dashboard/_components/patterns/ListPattern";
import { HandoverCategoryFields } from "@/app/dashboard/_components/inspector/list-variants/handover/HandoverCategoryFields";
import { CopySection } from "@/app/dashboard/_components/inspector/list-variants/handover/CopySection";
import { buildHandoverUpsertInput } from "@/app/dashboard/_components/inspector/list-variants/handover/upsert-input";
import { upsertHandoverRecord } from "@/features/handover/actions";
import { type HandoverCategoryKey } from "@/features/handover/categories";
import type { HandoverStatus } from "@/features/handover/schemas";
import type { EditFormProps } from "@/app/dashboard/_components/inspector/list-variants/types";
import { HandoverCategoryRail } from "./HandoverCategoryRail";

type StatusKey = HandoverStatus | "none";

const STATUS_LABEL: Record<StatusKey, string> = {
  none: "미작성",
  draft: "작성중",
  ready: "작성완료",
  published: "인계완료",
};
const STATUS_TONE: Record<StatusKey, string> = {
  none: "bg-washi-raised text-muted",
  draft: "bg-vermilion/15 text-vermilion",
  ready: "bg-sage/15 text-sage",
  published: "bg-ink/10 text-ink",
};

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
  const [status, setStatus] = useState<StatusKey>(
    (initialRow.handoverStatus as StatusKey | undefined) ?? "none",
  );
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
      if (res.ok) setStatus(res.row.status);
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
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard/handover"
            className="inline-flex shrink-0 items-center border border-line px-3 py-1 text-sm text-ink transition-colors hover:bg-ink hover:text-cream"
          >
            ← 목록 이동
          </Link>
          {/* 대학명 · 서비스명 */}
          <p className="min-w-0 truncate text-sm font-bold text-ink">
            {row.universityName ?? "—"}
            <span className="text-muted"> · </span>
            {row.serviceName ?? "—"}
          </p>
        </div>
        <div className="flex flex-none items-center gap-3">
          <span
            aria-label={`작성상태 ${STATUS_LABEL[status]}`}
            className={`inline-block px-2 py-0.5 text-2xs ${STATUS_TONE[status]}`}
          >
            {STATUS_LABEL[status]}
          </span>
          <span className="text-xs text-muted">
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
                <div className="absolute right-0 z-20 mt-1 w-80 border border-line bg-washi-raised p-3 shadow-lg">
                  <CopySection
                    fromServiceId={row.id}
                    candidates={handoverServiceCandidates ?? []}
                    onCopy={onCopyHandover}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 border border-line">
        <HandoverCategoryRail
          row={row}
          active={active}
          onChange={(key) => setActive(key)}
        />
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
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
