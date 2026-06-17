"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createReport } from "@/features/reports/actions";
import {
  REPORT_PERIOD_LABELS,
  type ReportPeriod,
} from "@/features/reports/schemas";
import { ModalShell } from "@/components/common/ModalShell";

const PERIOD_ORDER: ReportPeriod[] = [
  "this-week",
  "this-month",
  "last-month",
  "quarter",
  "year",
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function NewReportModal({ open, onClose }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState<ReportPeriod>("this-month");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await createReport({ title, period });
      if (r.ok) {
        onClose();
        setTitle("");
        router.push(`/dashboard/reports/${r.id}`);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <ModalShell
      title="새 리포트 생성"
      ariaLabel="새 리포트"
      onClose={onClose}
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
          >
            취소
          </button>
          <button
            type="submit"
            form="new-report-form"
            disabled={pending || !title.trim()}
            className="cursor-pointer border border-ink bg-ink px-4 py-1.5 text-sm font-medium text-cream transition-colors hover:bg-vermilion disabled:cursor-not-allowed disabled:text-cream/70"
          >
            {pending ? "생성 중…" : "생성"}
          </button>
        </>
      }
    >
      <form
        id="new-report-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-3"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted">제목</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 2026 5월 운영 리포트"
            required
            maxLength={200}
            className="border border-line bg-cream px-3 py-2 text-sm text-ink"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs text-muted">기간</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as ReportPeriod)}
            className="border border-line bg-cream px-3 py-2 text-sm text-ink"
          >
            {PERIOD_ORDER.map((p) => (
              <option key={p} value={p}>
                {REPORT_PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        {error ? <p className="text-xs text-vermilion">{error}</p> : null}
      </form>
    </ModalShell>
  );
}
