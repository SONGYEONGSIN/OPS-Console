"use client";

import { useRef, useState, type SetStateAction } from "react";
import Link from "next/link";
import type { ListRow } from "@/app/dashboard/_components/patterns/ListPattern";
import { HandoverCategoryFields } from "@/app/dashboard/_components/inspector/list-variants/handover/HandoverCategoryFields";
import { buildHandoverUpsertInput } from "@/app/dashboard/_components/inspector/list-variants/handover/upsert-input";
import { upsertHandoverRecord } from "@/features/handover/actions";
import {
  HANDOVER_CATEGORIES,
  type HandoverCategoryKey,
} from "@/features/handover/categories";
import type { MetaItem } from "@/app/dashboard/_components/page-header/PageMeta";
import { HandoverCategoryRail } from "./HandoverCategoryRail";

export function HandoverEditorWorkspace({
  initialRow,
  contractsStatusOptions,
  metaItems = [],
}: {
  initialRow: ListRow;
  contractsStatusOptions: string[];
  /** 표준 헤더 메타 라인 앞부분 (오전/오후 · 날짜) — 서버에서 계산해 전달 */
  metaItems?: MetaItem[];
}) {
  const [row, setRowState] = useState<ListRow>(initialRow);
  // 최신 row를 동기 추적 — setRow가 state updater 밖에서 next를 계산하도록.
  const rowRef = useRef<ListRow>(initialRow);
  const [active, setActive] = useState<HandoverCategoryKey>("contract");
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const headlineTitle = [row.applicationType, row.universityName ?? "—"]
    .filter(Boolean)
    .join(" ");

  const savedLabel = saved ? "✓ 자동 저장됨" : "저장 중…";

  const progressLink = (
    <Link
      href="/dashboard/handover?tab=progress"
      className="text-sm text-vermilion hover:underline"
    >
      인수인계 진행 이동 →
    </Link>
  );

  return (
    // 운영리포트 상세 골격 — 와이드 폭 + 상단 이동 텍스트 링크(버밀리언) +
    // 제목/메타 라인 + 헤더 룰 + 우측 정렬 액션(복제). 페이지 전체 스크롤.
    <div className="min-h-0 flex-1 overflow-y-auto bg-paper">
      <div className="p-5 md:p-6 lg:p-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard/handover"
            className="text-sm text-vermilion hover:underline"
          >
            ← 목록 이동
          </Link>
          {progressLink}
        </div>

        <header className="border-b border-line pb-4">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink">
            {headlineTitle}
            {row.serviceName ? (
              <>
                <span className="text-muted"> · </span>
                {row.serviceName}
              </>
            ) : null}
          </h1>
          {/* 메타 라인 — 운영리포트 상세와 동일 형식: 생성 일자 · 작성자 · 저장 상태 */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
            {metaItems.map((m) => (
              <span key={m.label} className="flex items-center gap-3">
                <span>{m.label}</span>
                <span className="text-line">·</span>
              </span>
            ))}
            <span>{savedLabel}</span>
          </div>
        </header>

        {/* 좌 nav / 우 패널 grid — 레일은 스크롤 시 상단 고정 */}
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
          <div className="md:sticky md:top-8 md:self-start">
            <HandoverCategoryRail
              row={row}
              active={active}
              onChange={(key) => setActive(key)}
            />
          </div>
          {/* min-w-0: field-sizing-content textarea의 긴 무공백 문자열(URL)이
              grid 컬럼을 밀어내지 않도록 최소폭 제약 해제 */}
          <div className="flex min-h-0 min-w-0 flex-col gap-4 pb-14">
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
    </div>
  );
}
