import Link from "next/link";
import type { ViewProps } from "../types";
import { ResendMailButton } from "./ResendMailButton";

const MAIL_STATUS_LABEL = {
  pending: "대기",
  sent: "발송됨",
  mail_failed: "발송 실패",
  dry_run: "테스트",
} as const;

const MAIL_STATUS_TONE = {
  pending: "bg-washi-raised text-muted",
  sent: "bg-sage/15 text-sage",
  mail_failed: "bg-vermilion/15 text-vermilion",
  dry_run: "bg-washi-raised text-ink-soft",
} as const;

export function BackupView({ row }: ViewProps) {
  const status = row.mailStatus ?? "pending";
  // PR-2: services chips는 join 상세(backupServicesDetail) — 대학명·서비스명 정규화 표기 + deep-link
  const servicesDetail = row.backupServicesDetail ?? [];
  const contacts = row.backupContacts ?? [];

  return (
    <div className="space-y-5 text-sm text-ink">
      <section className="space-y-1.5">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted">메타</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <span className="text-xs">
            <span className="text-muted">요청자</span>{" "}
            <span className="text-ink">{row.owner}</span>
          </span>
          <span className="text-xs">
            <span className="text-muted">백업자</span>{" "}
            <span className="text-ink">{row.substituteName ?? "—"}</span>
            {row.substituteEmail && (
              <span className="ml-1 text-2xs text-muted">
                ({row.substituteEmail})
              </span>
            )}
          </span>
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-2xs ${MAIL_STATUS_TONE[status]}`}
          >
            {MAIL_STATUS_LABEL[status]}
          </span>
        </div>
      </section>

      <section className="space-y-1.5">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted">
          휴가/외근 기간
        </p>
        <p className="font-mono text-xs text-ink">
          {row.leaveStartDate ?? "—"} ~ {row.leaveEndDate ?? "—"}
        </p>
      </section>

      {servicesDetail.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-2xs uppercase tracking-[0.18em] text-muted">
            담당 서비스
          </p>
          <div className="flex flex-wrap gap-1.5">
            {servicesDetail.map((s) => {
              // PR-3: 서비스별 백업자가 default(row.substituteName)와 다를 때만 표시
              const showSubstitute =
                s.substitute_name &&
                s.substitute_name !== row.substituteName;
              return (
                <Link
                  key={s.id}
                  href={`/dashboard/services?q=${encodeURIComponent(s.service_name)}`}
                  className="inline-block bg-line-soft px-2 py-0.5 text-2xs text-ink-soft hover:bg-washi-raised hover:text-ink"
                  title={`${s.university_name} — ${s.service_name}${showSubstitute ? ` / 백업자: ${s.substitute_name}` : ""}`}
                >
                  {s.university_name} — {s.service_name}
                  {showSubstitute && (
                    <span className="ml-1 text-muted">
                      / 백업자: {s.substitute_name}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {contacts.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-2xs uppercase tracking-[0.18em] text-muted">
            대학 연락처
          </p>
          <div className="flex flex-wrap gap-1.5">
            {contacts.map((c) => (
              <span
                key={c}
                className="inline-block bg-line-soft px-2 py-0.5 text-2xs text-ink-soft"
              >
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-1.5">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted">
          백업 내용
        </p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {row.summary ?? "내용 없음"}
        </p>
      </section>

      {status === "mail_failed" && (
        <section className="space-y-2">
          <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
            메일 발송 실패
          </p>
          {row.mailError && (
            <p className="rounded-lg border border-vermilion/30 bg-vermilion/5 p-2 text-xs text-ink">
              {row.mailError}
            </p>
          )}
          {row.id && <ResendMailButton backupRequestId={row.id} />}
        </section>
      )}

      {status === "dry_run" && row.id && (
        <section className="space-y-1.5">
          <p className="text-2xs uppercase tracking-[0.18em] text-muted">
            테스트 모드 (MAIL_DRY_RUN=true)
          </p>
          <ResendMailButton backupRequestId={row.id} />
        </section>
      )}
    </div>
  );
}
