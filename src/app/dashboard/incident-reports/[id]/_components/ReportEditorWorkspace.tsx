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
import { updateIncidentReport } from "@/features/incident-reports/actions";
import { updateIncident } from "@/features/incidents/actions";
import { FormPage } from "@/app/dashboard/_components/inspector/list-variants/incident-reports/FormPage";
import { HandlingRowsEditor } from "@/app/dashboard/_components/inspector/HandlingRowsEditor";

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
  { key: "gyeongwi", label: "경위", textarea: true },
  { key: "cause", label: "원인", textarea: true },
];
const POST_FIELDS: { key: TextKey; label: string; textarea: boolean }[] = [
  { key: "prevention", label: "대책", textarea: true },
];

const inputClass =
  "w-full border border-line bg-cream px-2 py-1 text-ink focus:border-vermilion focus:outline-none";

type ApprovalOverride = {
  approverName: string | null;
  approverRole: string | null;
  directorName: string | null;
  directorRole: string | null;
  ceoName: string | null;
  ceoRole: string | null;
};

export function ReportEditorWorkspace({
  report,
  previewDocNumber = null,
  approval,
  dutyName,
  dutyEmail,
  dutyPhone,
  serviceName,
}: {
  report: IncidentReportRow;
  /** 발송 전 예상 시행번호(공문관리대장 조회, 확정 아님) */
  previewDocNumber?: string | null;
  /** 결재라인 — 저장 스냅샷 + 라이브 보강(라우트에서 계산). 없으면 report 값 사용. */
  approval?: ApprovalOverride;
  /** 결재 담당자 표시명 — 연결된 사고의 작성 담당자(없으면 작성자). */
  dutyName?: string;
  /** 담당자 이메일 — 공문 하단 연락처에 사용(없으면 작성자). */
  dutyEmail?: string;
  /** 담당자 전화 — 공문 하단 연락처 전화에 사용(없으면 기본 대표번호). */
  dutyPhone?: string | null;
  /** 서비스명 — 연결 사고에서 동기화(읽기전용 표시). */
  serviceName?: string | null;
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
  // 공문 1번 인사말·3번 맺음말 — 기본값(자동 문구)으로 채워두되 수정 가능.
  const autoGreeting = `${report.recipient_university}의 무궁한 발전을 기원합니다.`;
  const DEFAULT_CLOSING = "감사합니다.";
  const [greeting, setGreeting] = useState(report.greeting ?? autoGreeting);
  const [closing, setClosing] = useState(report.closing ?? DEFAULT_CLOSING);
  const [page, setPage] = useState(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const editable = report.status === "draft" || report.status === "rejected";

  const source: FormSource = {
    recipientUniversity: draft.recipient_university,
    title: draft.title,
    draftDate: report.draft_date,
    authorName: dutyName ?? report.author_name,
    authorEmail: dutyEmail ?? report.author_email,
    authorPhone: dutyPhone ?? null,
    approverName: approval?.approverName ?? report.approver_name,
    approverRole: approval?.approverRole ?? report.approver_role,
    directorName: approval?.directorName ?? report.director_name,
    directorRole: approval?.directorRole ?? report.director_role,
    ceoName: approval?.ceoName ?? report.ceo_name,
    ceoRole: approval?.ceoRole ?? report.ceo_role,
    docNumber: report.doc_number ?? previewDocNumber,
    apology: draft.apology || null,
    greeting: greeting || null,
    closing: closing || null,
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

  function onSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const cleanRows = rows.filter((r) => r.time.trim() || r.content.trim());
      // 고유 필드(사과문/인사말/맺음말) → 경위서 소유. 제목·수신대학·서비스명은 사고에서 동기화(읽기전용).
      // 인사말·맺음말은 기본값 그대로면 null로 저장(자동 문구 유지), 바꿨으면 그 값 저장.
      const ownPatch = {
        apology: draft.apology || null,
        greeting:
          greeting.trim() && greeting !== autoGreeting ? greeting : null,
        closing: closing.trim() && closing !== DEFAULT_CLOSING ? closing : null,
      };
      // 공유 필드(경위/원인/처리/대책) → 연결 사고가 단일 소스.
      // 사고에 기록하면 사고 폼·다른 경위서와 자동 동기화(divergence 없음).
      if (report.incident_id) {
        const ri = await updateIncident(report.incident_id, {
          cause_summary: draft.gyeongwi || null,
          root_cause: draft.cause || null,
          handling_rows: cleanRows,
          prevention: draft.prevention || null,
        });
        if (!ri.ok) {
          setError(ri.error ?? "사고 저장에 실패했습니다.");
          return;
        }
        const rr = await updateIncidentReport(report.id, ownPatch);
        if (!rr.ok) {
          setError(rr.error ?? "저장에 실패했습니다.");
          return;
        }
      } else {
        // 미연결 경위서 — 공유 필드도 경위서에 직접 저장.
        const rr = await updateIncidentReport(report.id, {
          ...ownPatch,
          gyeongwi: draft.gyeongwi || null,
          cause: draft.cause || null,
          prevention: draft.prevention || null,
          handling_rows: cleanRows,
        });
        if (!rr.ok) {
          setError(rr.error ?? "저장에 실패했습니다.");
          return;
        }
      }
      setSaved(true);
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
        <div className="flex-1 overflow-y-auto bg-paper p-6">
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
              {/* 수신대학·서비스명·제목 — 연결 사고에서 동기화(읽기전용) */}
              <div className="space-y-1 border-b border-line pb-2 text-xs">
                <p className="text-muted">
                  수신대학{" "}
                  <span className="ml-1 text-ink">
                    {draft.recipient_university || "—"}
                  </span>
                </p>
                <p className="text-muted">
                  서비스명{" "}
                  <span className="ml-1 text-ink">{serviceName || "—"}</span>
                </p>
                <p className="text-muted">
                  제목{" "}
                  <span className="ml-1 text-ink">{draft.title || "—"}</span>
                  <span className="ml-1.5 text-2xs text-faint">
                    (사고에서 동기화 · 수정 불가)
                  </span>
                </p>
              </div>

              {/* 공문 cover — 1.인사말 / 2.사과 본문 / 3.맺음말 (경위 위에 배치).
                  인사말·맺음말은 기본 자동문구로 채워두되 수정 가능(바꾸면 그 값 저장). */}
              <div className="space-y-3 border-b border-line pb-2">
                <label className="block text-xs">
                  <span className="mb-1 block text-muted">
                    인사말 (공문 1번){" "}
                    {greeting !== autoGreeting && (
                      <button
                        type="button"
                        onClick={() => setGreeting(autoGreeting)}
                        className="ml-1 cursor-pointer border-none bg-transparent text-2xs text-vermilion hover:underline"
                      >
                        기본값 복원
                      </button>
                    )}
                  </span>
                  <textarea
                    aria-label="인사말"
                    value={greeting}
                    rows={2}
                    maxLength={1000}
                    onChange={(e) => setGreeting(e.target.value)}
                    className={inputClass}
                  />
                </label>

                {renderField({
                  key: "apology",
                  label: "사과 본문 (공문 2번)",
                  textarea: true,
                })}

                <label className="block text-xs">
                  <span className="mb-1 block text-muted">
                    맺음말 (공문 3번){" "}
                    {closing !== DEFAULT_CLOSING && (
                      <button
                        type="button"
                        onClick={() => setClosing(DEFAULT_CLOSING)}
                        className="ml-1 cursor-pointer border-none bg-transparent text-2xs text-vermilion hover:underline"
                      >
                        기본값 복원
                      </button>
                    )}
                  </span>
                  <textarea
                    aria-label="맺음말"
                    value={closing}
                    rows={2}
                    maxLength={1000}
                    onChange={(e) => setClosing(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              {PRE_FIELDS.map(renderField)}

              {/* 처리 — 시간/내용 행 편집기 (경위서·사고보고 공용) */}
              <HandlingRowsEditor rows={rows} onChange={setRows} />

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
          </div>
        )}
      </aside>
    </div>
  );
}
