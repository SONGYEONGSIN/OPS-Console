"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  REPORT_STATUS_LABEL,
  type IncidentReportRow,
  type HandlingRow,
} from "@/features/incident-reports/schemas";
import {
  deriveFormModel,
  type FormSource,
} from "@/features/incident-reports/form-content";
import {
  updateIncidentReport,
  revokeApproval,
} from "@/features/incident-reports/actions";
import { FormPage } from "@/app/dashboard/_components/inspector/list-variants/incident-reports/FormPage";

type TextKey =
  | "recipient_university"
  | "title"
  | "gyeongwi"
  | "cause"
  | "prevention"
  | "apology";

type TextDraft = Record<TextKey, string>;

/** 처리(rows) 앞/뒤로 나눠 렌더 — 문서 순서(경위→원인→처리→대책) 유지 */
const PRE_FIELDS: { key: TextKey; label: string; textarea: boolean }[] = [
  { key: "title", label: "제목", textarea: false },
  { key: "recipient_university", label: "수신대학", textarea: false },
  { key: "gyeongwi", label: "경위", textarea: true },
  { key: "cause", label: "원인", textarea: true },
];
const POST_FIELDS: { key: TextKey; label: string; textarea: boolean }[] = [
  { key: "prevention", label: "대책", textarea: true },
  { key: "apology", label: "사과 본문", textarea: true },
];

const inputClass =
  "w-full border border-line bg-cream px-2 py-1 text-ink focus:border-vermilion focus:outline-none";

export function ReportEditorWorkspace({
  report,
  canManageApproval = false,
}: {
  report: IncidentReportRow;
  /** 승인자 본인 또는 admin — 승인 취소 가능 */
  canManageApproval?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<TextDraft>({
    recipient_university: report.recipient_university,
    title: report.title,
    gyeongwi: report.gyeongwi ?? "",
    cause: report.cause ?? "",
    prevention: report.prevention ?? "",
    apology: report.apology ?? "",
  });
  const [rows, setRows] = useState<HandlingRow[]>(report.handling_rows ?? []);
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
    authorEmail: report.author_email,
    approverName: report.approver_name,
    approverRole: report.approver_role,
    directorName: report.director_name,
    directorRole: report.director_role,
    ceoName: report.ceo_name,
    ceoRole: report.ceo_role,
    docNumber: report.doc_number,
    apology: draft.apology || null,
    gyeongwi: draft.gyeongwi || null,
    cause: draft.cause || null,
    handling: report.handling, // 레거시 text 폴백 (rows 비었을 때만 표시)
    handlingRows: rows.filter((r) => r.time.trim() || r.content.trim()),
    prevention: draft.prevention || null,
  };
  const model = deriveFormModel(source);

  function setField(key: TextKey, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function updateRow(i: number, patch: Partial<HandlingRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((rs) => [...rs, { time: "", content: "" }]);
  }
  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, idx) => idx !== i));
  }

  function onSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await updateIncidentReport(report.id, {
        recipient_university: draft.recipient_university || undefined,
        title: draft.title || undefined,
        gyeongwi: draft.gyeongwi || null,
        cause: draft.cause || null,
        prevention: draft.prevention || null,
        apology: draft.apology || null,
        handling_rows: rows.filter((r) => r.time.trim() || r.content.trim()),
      });
      if (!r.ok) {
        setError(r.error ?? "저장에 실패했습니다.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function onRevoke() {
    setError(null);
    startTransition(async () => {
      const r = await revokeApproval(report.id);
      if (!r.ok) {
        setError(r.error ?? "승인 취소에 실패했습니다.");
        return;
      }
      router.refresh();
    });
  }

  function renderField({
    key,
    label,
    textarea,
  }: {
    key: TextKey;
    label: string;
    textarea: boolean;
  }) {
    return (
      <label key={key} className="block text-xs">
        <span className="mb-1 block text-muted">{label}</span>
        {textarea ? (
          <textarea
            aria-label={label}
            value={draft[key]}
            rows={4}
            maxLength={5000}
            onChange={(e) => setField(key, e.target.value)}
            className={inputClass}
          />
        ) : (
          <input
            aria-label={label}
            value={draft[key]}
            maxLength={200}
            onChange={(e) => setField(key, e.target.value)}
            className={inputClass}
          />
        )}
      </label>
    );
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
              {PRE_FIELDS.map(renderField)}

              {/* 처리 — 시간/내용 행 편집기 */}
              <div className="text-xs">
                <span className="mb-1 block text-muted">처리 (시간 / 내용)</span>
                <div className="space-y-1.5">
                  {rows.map((r, i) => (
                    <div key={i} className="flex gap-1">
                      <input
                        aria-label={`처리 시간 ${i + 1}`}
                        value={r.time}
                        maxLength={100}
                        placeholder="시간"
                        onChange={(e) => updateRow(i, { time: e.target.value })}
                        className={`${inputClass} w-28 shrink-0`}
                      />
                      <input
                        aria-label={`처리 내용 ${i + 1}`}
                        value={r.content}
                        maxLength={2000}
                        placeholder="내용"
                        onChange={(e) =>
                          updateRow(i, { content: e.target.value })
                        }
                        className={inputClass}
                      />
                      <button
                        type="button"
                        aria-label={`처리 행 삭제 ${i + 1}`}
                        onClick={() => removeRow(i)}
                        className="shrink-0 cursor-pointer border border-line bg-transparent px-2 text-muted hover:text-vermilion"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addRow}
                  className="mt-1.5 cursor-pointer border border-line bg-transparent px-2 py-1 text-2xs text-ink hover:bg-washi-raised"
                >
                  + 처리 행 추가
                </button>
              </div>

              {POST_FIELDS.map(renderField)}
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
          <div className="space-y-3">
            <p className="text-xs text-muted">
              편집할 수 없는 상태입니다. (미리보기·PDF만)
            </p>
            {report.status === "approved" && canManageApproval && (
              <div className="space-y-2">
                {error && <p className="text-xs text-vermilion">{error}</p>}
                <button
                  type="button"
                  disabled={pending}
                  onClick={onRevoke}
                  className="w-full cursor-pointer border border-vermilion bg-transparent px-3 py-1.5 text-sm text-vermilion hover:bg-vermilion hover:text-cream disabled:opacity-50"
                >
                  {pending ? "처리 중…" : "승인 취소 (작성중으로 되돌리기)"}
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
