"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  REPORT_STATUS_LABEL,
  type IncidentReportRow,
} from "@/features/incident-reports/schemas";
import {
  deriveFormModel,
  type FormSource,
} from "@/features/incident-reports/form-content";
import { updateIncidentReport } from "@/features/incident-reports/actions";
import { FormPage } from "@/app/dashboard/_components/inspector/list-variants/incident-reports/FormPage";

type EditableKey =
  | "recipient_university"
  | "title"
  | "gyeongwi"
  | "cause"
  | "handling"
  | "prevention"
  | "apology";

type Editable = Record<EditableKey, string>;

const FIELD_DEFS: { key: EditableKey; label: string; textarea: boolean }[] = [
  { key: "title", label: "제목", textarea: false },
  { key: "recipient_university", label: "수신대학", textarea: false },
  { key: "gyeongwi", label: "경위", textarea: true },
  { key: "cause", label: "원인", textarea: true },
  { key: "handling", label: "처리", textarea: true },
  { key: "prevention", label: "대책", textarea: true },
  { key: "apology", label: "사과 본문", textarea: true },
];

const inputClass =
  "w-full border border-line bg-cream px-2 py-1 text-ink focus:border-vermilion focus:outline-none";

export function ReportEditorWorkspace({
  report,
}: {
  report: IncidentReportRow;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<Editable>({
    recipient_university: report.recipient_university,
    title: report.title,
    gyeongwi: report.gyeongwi ?? "",
    cause: report.cause ?? "",
    handling: report.handling ?? "",
    prevention: report.prevention ?? "",
    apology: report.apology ?? "",
  });
  const [page, setPage] = useState(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const editable = report.status === "draft" || report.status === "rejected";

  const source: FormSource = {
    recipientUniversity: draft.recipient_university,
    title: draft.title,
    draftDate: report.draft_date,
    authorName: report.author_name,
    approverName: report.approver_name,
    directorName: report.director_name,
    ceoName: report.ceo_name,
    docNumber: report.doc_number,
    apology: draft.apology || null,
    gyeongwi: draft.gyeongwi || null,
    cause: draft.cause || null,
    handling: draft.handling || null,
    prevention: draft.prevention || null,
  };
  const model = deriveFormModel(source);

  function onSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await updateIncidentReport(report.id, {
        recipient_university: draft.recipient_university || undefined,
        title: draft.title || undefined,
        gyeongwi: draft.gyeongwi || null,
        cause: draft.cause || null,
        handling: draft.handling || null,
        prevention: draft.prevention || null,
        apology: draft.apology || null,
      });
      if (!r.ok) {
        setError(r.error ?? "저장에 실패했습니다.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto bg-washi-raised p-6">
          <FormPage model={model} page={page} />
        </div>
        <div className="mt-3 flex items-center justify-center gap-4">
          <button
            type="button"
            aria-label="이전 페이지"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="cursor-pointer border border-line bg-transparent px-3 py-1 text-sm text-ink hover:bg-washi-raised disabled:opacity-40"
          >
            ◀
          </button>
          <span className="text-sm text-muted">{page} / 2</span>
          <button
            type="button"
            aria-label="다음 페이지"
            disabled={page >= 2}
            onClick={() => setPage((p) => Math.min(2, p + 1))}
            className="cursor-pointer border border-line bg-transparent px-3 py-1 text-sm text-ink hover:bg-washi-raised disabled:opacity-40"
          >
            ▶
          </button>
          <a
            href={`/api/incident-reports/${report.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-4 cursor-pointer border border-line bg-transparent px-3 py-1 text-sm text-ink hover:bg-washi-raised"
          >
            PDF
          </a>
        </div>
      </div>

      <aside className="flex w-[360px] shrink-0 flex-col border-l border-line pl-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold text-ink">편집</span>
          <span className="text-2xs text-muted">
            {REPORT_STATUS_LABEL[report.status]}
          </span>
        </div>
        {editable ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {FIELD_DEFS.map(({ key, label, textarea }) => (
                <label key={key} className="block text-xs">
                  <span className="mb-1 block text-muted">{label}</span>
                  {textarea ? (
                    <textarea
                      aria-label={label}
                      value={draft[key]}
                      rows={4}
                      maxLength={5000}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [key]: e.target.value }))
                      }
                      className={inputClass}
                    />
                  ) : (
                    <input
                      aria-label={label}
                      value={draft[key]}
                      maxLength={200}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [key]: e.target.value }))
                      }
                      className={inputClass}
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {error && <p className="text-xs text-vermilion">{error}</p>}
              {saved && <p className="text-xs text-sage">저장되었습니다.</p>}
              <button
                type="button"
                disabled={pending}
                onClick={onSave}
                className="w-full cursor-pointer border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
              >
                {pending ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted">
            편집할 수 없는 상태입니다. (미리보기·PDF만)
          </p>
        )}
      </aside>
    </div>
  );
}
