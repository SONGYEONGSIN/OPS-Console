"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createReport } from "@/features/reports/actions";
import {
  REPORT_PERIOD_LABELS,
  type ReportPeriod,
} from "@/features/reports/schemas";

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
    <div
      role="dialog"
      aria-label="새 리포트"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md border border-line bg-cream p-6"
      >
        <h3 className="mb-4 text-base font-bold text-ink">새 리포트 생성</h3>

        <label className="mb-3 flex flex-col gap-1 text-sm">
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

        <label className="mb-4 flex flex-col gap-1 text-sm">
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

        {error ? (
          <p className="mb-3 text-xs text-vermilion">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-line-soft"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={pending || !title.trim()}
            className="border border-vermilion bg-vermilion px-3 py-1.5 text-sm text-cream disabled:opacity-50"
          >
            {pending ? "생성 중…" : "생성"}
          </button>
        </div>
      </form>
    </div>
  );
}
