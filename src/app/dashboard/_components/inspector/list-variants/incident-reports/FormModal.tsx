"use client";

import { useEffect, useState, useTransition } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import { FormPreview } from "./FormPreview";
import { updateIncidentReport } from "@/features/incident-reports/actions";

type Props = {
  open: boolean;
  onClose: () => void;
  row: ListRow;
  onSaved?: () => void;
};

const inputClass =
  "w-full border border-line bg-cream px-2 py-1 text-ink focus:border-vermilion focus:outline-none";

export function FormModal({ open, onClose, row, onSaved }: Props) {
  const [draft, setDraft] = useState<ListRow>(row);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const status = draft.incidentReportStatus ?? "draft";
  const editable = status === "draft" || status === "rejected";

  function field(key: keyof ListRow, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value || null }));
  }

  function onSave() {
    setError(null);
    startTransition(async () => {
      const r = await updateIncidentReport(row.id, {
        recipient_university: draft.incidentReportUniversity ?? undefined,
        title: draft.incidentReportTitle ?? undefined,
        gyeongwi: draft.incidentReportGyeongwi ?? null,
        cause: draft.incidentReportCause ?? null,
        handling: draft.incidentReportHandling ?? null,
        prevention: draft.incidentReportPrevention ?? null,
        apology: draft.incidentReportApology ?? null,
      });
      if (!r.ok) {
        setError(r.error ?? "저장에 실패했습니다.");
        return;
      }
      onSaved?.();
      onClose();
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="경위서 양식"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[90vh] w-full max-w-6xl flex-col border border-line bg-washi"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-base font-bold text-ink">
            경위서 — {draft.incidentReportTitle ?? "제목 없음"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="cursor-pointer text-muted hover:text-ink"
          >
            ✕
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          {editable && (
            <div className="w-80 shrink-0 space-y-3 overflow-y-auto border-r border-line p-4">
              <label className="block text-xs">
                <span className="mb-1 block text-muted">제목</span>
                <input
                  aria-label="제목"
                  value={draft.incidentReportTitle ?? ""}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      incidentReportTitle: e.target.value,
                    }))
                  }
                  maxLength={200}
                  className={inputClass}
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block text-muted">수신대학</span>
                <input
                  aria-label="수신대학"
                  value={draft.incidentReportUniversity ?? ""}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      incidentReportUniversity: e.target.value,
                    }))
                  }
                  maxLength={200}
                  className={inputClass}
                />
              </label>
              {(
                [
                  ["경위", "incidentReportGyeongwi"],
                  ["원인", "incidentReportCause"],
                  ["처리", "incidentReportHandling"],
                  ["대책", "incidentReportPrevention"],
                  ["사과 본문", "incidentReportApology"],
                ] as const
              ).map(([label, key]) => (
                <label key={key} className="block text-xs">
                  <span className="mb-1 block text-muted">{label}</span>
                  <textarea
                    aria-label={label}
                    value={(draft[key] as string | null) ?? ""}
                    onChange={(e) => field(key, e.target.value)}
                    rows={4}
                    maxLength={5000}
                    className={inputClass}
                  />
                </label>
              ))}
            </div>
          )}

          <div className="min-w-0 flex-1 overflow-y-auto bg-washi-raised p-6">
            <FormPreview row={draft} />
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t border-line px-5 py-3">
          {error && <span className="text-xs text-vermilion">{error}</span>}
          <div className="ml-auto flex gap-2">
            <a
              href={`/api/incident-reports/${row.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi-raised"
            >
              PDF
            </a>
            {editable && (
              <button
                type="button"
                disabled={pending}
                onClick={onSave}
                className="cursor-pointer border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
              >
                {pending ? "저장 중…" : "저장"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi-raised"
            >
              닫기
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
