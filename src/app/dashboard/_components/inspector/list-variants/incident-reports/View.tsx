"use client";

import { useState, useTransition } from "react";
import { Section, DefList, Divider } from "../shared";
import type { ViewProps } from "../types";
import { REPORT_STATUS_LABEL } from "@/features/incident-reports/schemas";
import {
  submitForApproval,
  approveIncidentReport,
  rejectIncidentReport,
} from "@/features/incident-reports/actions";
import { sendIncidentReport } from "@/features/incident-reports/mail-actions";
import { STATUS_TONE } from "./status";

type Recipient = { email: string; name: string; jobTitle: string | null };

/** 본문 텍스트 블록 — 비어있으면 "—" */
function BodyText({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-xs text-muted">—</span>;
  return (
    <p className="whitespace-pre-wrap rounded bg-washi-raised p-2.5 text-sm leading-relaxed text-ink">
      {value}
    </p>
  );
}

type IncidentReportViewProps = ViewProps & {
  /** 액션 성공 후 호출 — 사고 탭에서 번들 refetch 트리거 (revalidatePath 미적용 컨텍스트) */
  onChanged?: () => void;
};

export function IncidentReportView({ row, onChanged }: IncidentReportViewProps) {
  const status = row.incidentReportStatus ?? "draft";
  const recipients = (row.incidentReportRecipients ?? []) as Recipient[];
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        setError(r.error ?? "처리에 실패했습니다.");
        return;
      }
      onChanged?.();
    });
  }

  function toggleRecipient(email: string) {
    setSelected((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email],
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-1.5">
        <div className="flex items-center gap-3">
          {row.incidentReportUniversity && (
            <span className="text-sm font-medium text-ink">
              {row.incidentReportUniversity}
            </span>
          )}
          <span
            className={`ml-auto inline-block px-2 py-0.5 text-2xs ${STATUS_TONE[status]}`}
          >
            {REPORT_STATUS_LABEL[status]}
          </span>
        </div>
        {row.incidentReportTitle && (
          <p className="text-sm font-medium text-ink">{row.incidentReportTitle}</p>
        )}
        {row.incidentReportDraftDate && (
          <p className="text-xs text-muted">작성일 {row.incidentReportDraftDate}</p>
        )}
      </section>

      {status === "rejected" && row.incidentReportRejectReason && (
        <div className="rounded border border-vermilion/40 bg-vermilion/10 p-2.5 text-xs text-vermilion">
          반려 사유: {row.incidentReportRejectReason}
        </div>
      )}

      <Divider />

      <Section title="경위">
        <BodyText value={row.incidentReportGyeongwi} />
      </Section>
      <Section title="원인">
        <BodyText value={row.incidentReportCause} />
      </Section>
      <Section title="처리">
        <BodyText value={row.incidentReportHandling} />
      </Section>
      <Section title="대책">
        <BodyText value={row.incidentReportPrevention} />
      </Section>

      <Divider />

      <Section title="결재라인">
        <DefList
          items={[
            { term: "담당자", desc: row.incidentReportAuthorName ?? "—" },
            { term: "팀장", desc: row.incidentReportApproverName ?? "—" },
            { term: "본부장", desc: row.incidentReportDirectorName ?? "—" },
            { term: "사장", desc: row.incidentReportCeoName ?? "—" },
          ]}
        />
      </Section>

      <Divider />

      <section className="space-y-2">
        {error && <p className="text-xs text-vermilion">{error}</p>}

        {(status === "draft" || status === "rejected") && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => submitForApproval(row.id))}
            className="w-full cursor-pointer border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
          >
            {pending ? "처리 중…" : "승인 요청"}
          </button>
        )}

        {status === "pending_approval" && row.incidentReportIsApprover && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => approveIncidentReport(row.id))}
              className="flex-1 cursor-pointer border border-sage bg-sage px-3 py-1.5 text-sm font-medium text-cream hover:bg-sage/90 disabled:opacity-50"
            >
              승인
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const reason = window.prompt("반려 사유를 입력하세요.");
                if (reason && reason.trim()) {
                  run(() => rejectIncidentReport(row.id, reason.trim()));
                }
              }}
              className="flex-1 cursor-pointer border border-vermilion bg-transparent px-3 py-1.5 text-sm text-vermilion hover:bg-vermilion hover:text-cream disabled:opacity-50"
            >
              반려
            </button>
          </div>
        )}

        {status === "approved" && row.incidentReportCanSend && (
          <div className="space-y-2">
            {!picking ? (
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="w-full cursor-pointer border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
              >
                발송
              </button>
            ) : recipients.length === 0 ? (
              <p className="text-xs text-muted">
                이 대학({row.incidentReportUniversity})에 등록된 연락처 이메일이 없습니다.
              </p>
            ) : (
              <div className="space-y-2">
                <span className="block text-xs text-muted">수신자 선택</span>
                <ul className="max-h-48 space-y-1 overflow-y-auto border border-line-soft bg-washi-raised p-1.5">
                  {recipients.map((r) => (
                    <li key={r.email}>
                      <label className="flex cursor-pointer items-center gap-2 px-1.5 py-1 text-2xs text-ink hover:bg-line-soft">
                        <input
                          type="checkbox"
                          checked={selected.includes(r.email)}
                          onChange={() => toggleRecipient(r.email)}
                        />
                        <span>
                          {r.name}
                          {r.jobTitle ? ` (${r.jobTitle})` : ""} · {r.email}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending || selected.length === 0}
                    onClick={() =>
                      run(() =>
                        sendIncidentReport({
                          id: row.id,
                          recipient_emails: selected,
                        }),
                      )
                    }
                    className="flex-1 cursor-pointer border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
                  >
                    {pending ? "발송 중…" : `발송 (${selected.length}명)`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPicking(false);
                      setSelected([]);
                    }}
                    className="flex-1 cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {status === "sent" && (
          <p className="text-xs text-sage">발송 완료된 경위서입니다.</p>
        )}
      </section>
    </div>
  );
}
