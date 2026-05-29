import Link from "next/link";
import { Section, DefList, Divider } from "../shared";
import type { ViewProps } from "../types";
import { ResendMailButton } from "./ResendMailButton";

const MAIL_STATUS_LABEL = {
  pending: "대기",
  scheduled: "예약됨",
  sending: "발송 중",
  sent: "발송됨",
  mail_failed: "발송 실패",
  dry_run: "테스트",
} as const;

const MAIL_STATUS_TONE = {
  pending: "bg-washi-raised text-muted",
  scheduled: "bg-washi-raised text-ink",
  sending: "bg-washi-raised text-ink-soft",
  sent: "bg-sage/15 text-sage",
  mail_failed: "bg-vermilion/15 text-vermilion",
  dry_run: "bg-washi-raised text-ink-soft",
} as const;

export function BackupView({ row }: ViewProps) {
  const status = row.mailStatus ?? "pending";
  const servicesDetail = row.backupServicesDetail ?? [];

  // 서비스별 모드일 땐 카드의 substitute_name이 정답. distinct names join.
  // 1명 일괄(또는 detail 비어있음)이면 parent substituteName + email 표시.
  const substituteNames = new Set<string>();
  for (const d of servicesDetail) {
    if (d.substitute_name) substituteNames.add(d.substitute_name);
  }
  const substituteDesc =
    substituteNames.size > 1 ? (
      Array.from(substituteNames).join(", ")
    ) : row.substituteEmail ? (
      <span>
        {row.substituteName ?? "—"}
        <span className="ml-1 text-2xs text-muted">
          ({row.substituteEmail})
        </span>
      </span>
    ) : (
      (row.substituteName ?? "—")
    );

  // PR-6: 예약 시각 표시 — scheduled 상태일 때만 메타에 노출 (KST yyyy-mm-dd HH:mm)
  const scheduledLabel = row.scheduledAt
    ? new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(row.scheduledAt))
    : null;

  const metaItems = [
    { term: "요청자", desc: row.owner },
    ...(row.requesterTeam
      ? [{ term: "팀 구분", desc: row.requesterTeam }]
      : []),
    { term: "백업자", desc: substituteDesc },
    {
      term: "메일 상태",
      desc: (
        <span
          className={`inline-block px-2 py-0.5 text-2xs ${MAIL_STATUS_TONE[status]}`}
        >
          {MAIL_STATUS_LABEL[status]}
        </span>
      ),
    },
  ];
  if (status === "scheduled" && scheduledLabel) {
    metaItems.push({ term: "예약 시각", desc: scheduledLabel });
  }

  return (
    <div className="space-y-6">
      <Section title="메타">
        <DefList items={metaItems} />
      </Section>

      <Divider />

      <Section title="휴가·외근 기간">
        <DefList
          items={[
            { term: "휴가유형", desc: row.leaveType ?? "—" },
            { term: "시작", desc: row.leaveStartDate ?? "—" },
            { term: "종료", desc: row.leaveEndDate ?? "—" },
          ]}
        />
      </Section>

      <Divider />

      <Section title="공통 메모">
        <p className="whitespace-pre-wrap rounded bg-washi-raised p-2.5 text-sm leading-relaxed text-ink">
          {row.summary ?? "내용 없음"}
        </p>
      </Section>

      {servicesDetail.length > 0 && (
        <>
          <Divider />
          <Section title="백업 서비스">
            <div className="flex flex-col gap-2">
              {servicesDetail.map((s) => {
                // PR-6: 카드별 백업자를 항상 표시 — 사용자가 어느 서비스 누가 백업하는지 즉시 확인.
                // 미지정 시 parent substituteName fallback (DB 무결성 보장으로 거의 채워짐).
                const substituteForCard =
                  s.substitute_name ?? row.substituteName ?? null;
                return (
                  <div
                    key={s.id}
                    className="border border-line-soft bg-washi-raised p-2.5"
                  >
                    <Link
                      href={`/dashboard/services?q=${encodeURIComponent(s.service_name)}`}
                      className="block text-2xs text-ink-soft hover:text-ink"
                    >
                      <span>
                        {s.university_name} — {s.service_name}
                      </span>
                      {substituteForCard && (
                        <span className="ml-1 text-muted">
                          / 백업자: {substituteForCard}
                        </span>
                      )}
                    </Link>
                    {s.contacts.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {s.contacts.map((c) => (
                          <span
                            key={c.contact_id}
                            className="inline-block bg-line-soft px-1.5 py-0.5 text-2xs text-ink-soft"
                          >
                            {c.university_name} — {c.customer_name}
                          </span>
                        ))}
                      </div>
                    )}
                    {s.note_md && (
                      <p className="mt-1.5 whitespace-pre-wrap rounded-sm bg-cream px-2 py-1 text-2xs text-ink">
                        {s.note_md}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        </>
      )}

      {status === "mail_failed" && (
        <>
          <Divider />
          <Section title="메일 발송 실패">
            <div className="space-y-2">
              {row.mailError && (
                <p className="rounded-lg border border-vermilion/30 bg-vermilion/5 p-2 text-xs text-ink">
                  {row.mailError}
                </p>
              )}
              {row.id && <ResendMailButton backupRequestId={row.id} />}
            </div>
          </Section>
        </>
      )}

      {status === "dry_run" && row.id && (
        <>
          <Divider />
          <Section title="테스트 모드 (MAIL_DRY_RUN=true)">
            <ResendMailButton backupRequestId={row.id} />
          </Section>
        </>
      )}
    </div>
  );
}
