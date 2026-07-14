"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Section, DefList, Divider, HandlingRowsBody } from "../shared";
import type { ViewProps } from "../types";
import { REPORT_STATUS_LABEL } from "@/features/incident-reports/schemas";
import {
  submitForApproval,
  approveIncidentReport,
  rejectIncidentReport,
  revokeApproval,
  revokeSend,
} from "@/features/incident-reports/actions";
import { sendIncidentReport } from "@/features/incident-reports/mail-actions";
import {
  incidentReportMailSubject,
  incidentReportMailBody,
} from "@/features/incident-reports/mail-template";
import { STATUS_TONE } from "./status";

type Recipient = { email: string; name: string; jobTitle: string | null };
type CcRecipient = { email: string; name: string };

const inputClass =
  "w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white";

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

export function IncidentReportView({
  row,
  onChanged,
}: IncidentReportViewProps) {
  const router = useRouter();
  const status = row.incidentReportStatus ?? "draft";
  const recipients = (row.incidentReportRecipients ?? []) as Recipient[];
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  // 발송 compose 상태 (자료요청 패턴)
  const title = row.incidentReportTitle ?? "";
  const authorName = row.incidentReportAuthorName ?? "";
  const approverEmail = row.incidentReportApproverEmail ?? "";
  const approverName = row.incidentReportApproverName ?? "팀장";
  const [search, setSearch] = useState("");
  const [justSelected, setJustSelected] = useState(false);
  const [toEmail, setToEmail] = useState("");
  // 팀장(승인자)을 기본 CC로 자동 추가
  const [cc, setCc] = useState<CcRecipient[]>(() =>
    approverEmail ? [{ email: approverEmail, name: approverName }] : [],
  );
  const [subject, setSubject] = useState(() =>
    incidentReportMailSubject(title),
  );
  const [body, setBody] = useState(() =>
    incidentReportMailBody({ title, authorName }),
  );

  const term = search.trim().toLowerCase();
  const matches =
    term === ""
      ? []
      : recipients.filter(
          (r) =>
            r.name.toLowerCase().includes(term) ||
            r.email.toLowerCase().includes(term),
        );
  const toRecipient = recipients.find((r) => r.email === toEmail);

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

  function selectTo(r: Recipient) {
    setCc((prev) => prev.filter((c) => c.email !== r.email));
    setToEmail(r.email);
    setSearch(r.name);
    setJustSelected(true);
  }
  function addCc(email: string) {
    const r = recipients.find((x) => x.email === email);
    if (r && !cc.some((c) => c.email === email) && email !== toEmail)
      setCc([...cc, { email: r.email, name: r.name }]);
  }
  function removeCc(email: string) {
    setCc(cc.filter((c) => c.email !== email));
  }

  return (
    <div className="space-y-6">
      <section className="space-y-1.5">
        <div className="flex items-center gap-3">
          {row.incidentReportUniversity && (
            <span className="text-sm font-medium text-ink">
              {row.incidentReportUniversity}
              {row.incidentReportServiceName && (
                <span className="ml-1.5 text-xs font-normal text-muted">
                  · {row.incidentReportServiceName}
                </span>
              )}
            </span>
          )}
          <span
            className={`ml-auto inline-block px-2 py-0.5 text-2xs ${
              status === "draft"
                ? "bg-vermilion/10 font-bold text-vermilion"
                : STATUS_TONE[status]
            }`}
          >
            {REPORT_STATUS_LABEL[status]}
          </span>
        </div>
        {row.incidentReportTitle && (
          <p className="text-sm font-medium text-ink">
            {row.incidentReportTitle}
          </p>
        )}
        {row.incidentReportDraftDate && (
          <p className="text-xs text-muted">
            작성일 {row.incidentReportDraftDate}
          </p>
        )}
      </section>

      <button
        type="button"
        onClick={() => router.push(`/dashboard/incident-reports/${row.id}`)}
        className="w-full cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink transition-colors hover:bg-ink hover:text-cream"
      >
        경위서 내용 보기
      </button>

      {status === "approved" &&
        (row.incidentReportIsApprover || row.incidentReportCanSend) && (
          <div className="space-y-1">
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => revokeApproval(row.id))}
              className="w-full cursor-pointer border border-vermilion bg-transparent px-3 py-1.5 text-sm text-vermilion hover:bg-vermilion hover:text-cream disabled:opacity-50"
            >
              {pending ? "처리 중…" : "승인 취소 (작성중으로 되돌리기)"}
            </button>
            <p className="text-2xs text-muted">
              승인을 취소하면 시행번호가 회수되어 공문관리대장에서 제거됩니다.
              재승인 후 PDF 발급 시 새 시행번호가 발급됩니다.
            </p>
          </div>
        )}

      {status === "sent" && row.incidentReportIsAdmin && (
        <div className="space-y-1">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => revokeSend(row.id))}
            className="w-full cursor-pointer border border-vermilion bg-transparent px-3 py-1.5 text-sm text-vermilion hover:bg-vermilion hover:text-cream disabled:opacity-50"
          >
            {pending ? "처리 중…" : "발송 취소 (승인완료로 되돌리기)"}
          </button>
          <p className="text-2xs text-muted">
            이미 발송된 메일은 회수되지 않습니다. 시행번호·공문관리대장은
            유지됩니다.
          </p>
        </div>
      )}

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
        <HandlingRowsBody
          rows={row.incidentReportHandlingRows}
          fallback={row.incidentReportHandling}
        />
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
                이 대학({row.incidentReportUniversity})에 등록된 연락처 이메일이
                없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {/* 발신자 */}
                <div className="block text-xs">
                  <span className="mb-1 block text-muted">발신자</span>
                  <div className="w-full border border-line bg-washi-raised px-2 py-1 text-ink">
                    {authorName} · {row.incidentReportAuthorEmail}
                  </div>
                </div>

                {/* 수신자 — 연락처 검색 → 단일 선택 */}
                <div className="block text-xs">
                  <span className="mb-1 block text-muted">수신자</span>
                  <input
                    type="text"
                    aria-label="수신자 검색"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setJustSelected(false);
                    }}
                    placeholder="연락처 검색 (이름/이메일)"
                    className={inputClass}
                  />
                  {!justSelected && matches.length > 0 && (
                    <ul
                      aria-label="수신자 검색 결과"
                      className="mt-1 max-h-40 overflow-y-auto border border-line-soft bg-washi-raised"
                    >
                      {matches.map((r) => (
                        <li key={r.email}>
                          <button
                            type="button"
                            onClick={() => selectTo(r)}
                            className="block w-full cursor-pointer border-none bg-transparent px-2 py-1 text-left text-2xs text-ink hover:bg-line-soft"
                          >
                            {r.name}
                            {r.jobTitle ? ` (${r.jobTitle})` : ""} · {r.email}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {toRecipient && (
                    <p className="mt-1 text-2xs text-muted">
                      받는 사람:{" "}
                      <span className="text-ink">
                        {toRecipient.name} · {toRecipient.email}
                      </span>
                    </p>
                  )}
                </div>

                {/* 참조 (CC) — 팀장 자동 + 추가 */}
                <div className="block text-xs">
                  <span className="mb-1 block text-muted">참조 (CC)</span>
                  {cc.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap gap-1.5">
                      {cc.map((c) => (
                        <span
                          key={c.email}
                          className="inline-flex items-center gap-1 border border-line px-2 py-0.5 text-ink"
                        >
                          {c.name}
                          <button
                            type="button"
                            onClick={() => removeCc(c.email)}
                            aria-label={`${c.name} 참조 제거`}
                            className="cursor-pointer text-muted hover:text-vermilion"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <select
                    aria-label="참조 추가"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) addCc(e.target.value);
                    }}
                    className={inputClass}
                  >
                    <option value="">+ 참조 추가</option>
                    {recipients
                      .filter(
                        (r) =>
                          r.email !== toEmail &&
                          !cc.some((c) => c.email === r.email),
                      )
                      .map((r) => (
                        <option key={r.email} value={r.email}>
                          {r.name} · {r.email}
                        </option>
                      ))}
                  </select>
                </div>

                {/* 제목 */}
                <label className="block text-xs">
                  <span className="mb-1 block text-muted">제목</span>
                  <input
                    aria-label="제목"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className={inputClass}
                  />
                </label>

                {/* 본문 */}
                <label className="block text-xs">
                  <span className="mb-1 block text-muted">본문</span>
                  <textarea
                    aria-label="본문"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={8}
                    className={inputClass}
                  />
                </label>

                <p className="text-2xs text-muted">
                  · 경위서 PDF가 자동 첨부됩니다.
                </p>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={
                      pending || !toEmail || !subject.trim() || !body.trim()
                    }
                    onClick={() =>
                      run(() =>
                        sendIncidentReport({
                          id: row.id,
                          to_email: toEmail,
                          cc_emails: cc.map((c) => c.email),
                          subject,
                          body,
                        }),
                      )
                    }
                    className="flex-1 cursor-pointer border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:opacity-50"
                  >
                    {pending ? "발송 중…" : "발송"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPicking(false)}
                    className="flex-1 cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-line-soft"
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
