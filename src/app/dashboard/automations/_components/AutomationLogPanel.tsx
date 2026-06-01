"use client";

import {
  Section,
  DefList,
  Divider,
} from "@/app/dashboard/_components/inspector/list-variants/shared";
import {
  formatKrw,
  type JobRunLog,
  type DepositMatchEntry,
  type MailOperatorEntry,
  type InsightsBatchEntry,
} from "@/features/automations/run-logs-normalize";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR");
}

function ModeBadge({ mode }: { mode: "dry_run" | "live" }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[11px] ${
        mode === "live"
          ? "bg-vermilion/20 text-vermilion-deep"
          : "bg-washi-raised text-muted"
      }`}
    >
      {mode === "live" ? "LIVE" : "DRY-RUN"}
    </span>
  );
}

function StatusBadge({ status }: { status: "sent" | "failed" | "dry_run" }) {
  const label =
    status === "sent" ? "발송" : status === "failed" ? "실패" : "DRY-RUN";
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[11px] ${
        status === "failed"
          ? "bg-vermilion/20 text-vermilion-deep"
          : status === "sent"
            ? "bg-washi-raised text-ink"
            : "bg-washi-raised text-muted"
      }`}
    >
      {label}
    </span>
  );
}

function DepositMatchList({ entries }: { entries: DepositMatchEntry[] }) {
  return (
    <div className="space-y-5">
      {entries.map((e, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-ink">{fmtTime(e.startedAt)}</span>
            <ModeBadge mode={e.mode} />
          </div>
          <p className="text-xs text-muted">
            매칭 {e.matchedCount} · 불일치 {e.mismatchCount} · 에러{" "}
            {e.errorCount}
            {e.skipLines.length > 0 && ` · 스킵 ${e.skipLines.length}`}
          </p>
          {e.matchedLines.length > 0 && (
            <ul className="space-y-1 text-xs text-sage">
              {e.matchedLines.map((line, j) => (
                <li key={j}>✓ {line}</li>
              ))}
            </ul>
          )}
          {e.mismatchLines.length > 0 && (
            <ul className="space-y-1 text-xs text-vermilion-deep">
              {e.mismatchLines.map((line, j) => (
                <li key={j}>▸ {line}</li>
              ))}
            </ul>
          )}
          {e.errorLines.length > 0 && (
            <ul className="space-y-1 text-xs text-vermilion">
              {e.errorLines.map((line, j) => (
                <li key={j}>! {line}</li>
              ))}
            </ul>
          )}
          {e.skipLines.length > 0 && (
            <ul className="space-y-1 text-xs text-muted">
              {e.skipLines.map((line, j) => (
                <li key={j}>↷ {line}</li>
              ))}
            </ul>
          )}
          {i < entries.length - 1 && <Divider />}
        </div>
      ))}
    </div>
  );
}

function MailOperatorList({ entries }: { entries: MailOperatorEntry[] }) {
  return (
    <div className="space-y-5">
      {entries.map((e, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-ink">{fmtTime(e.sentAt)}</span>
            <StatusBadge status={e.status} />
          </div>
          <DefList
            items={[
              {
                term: "수신자",
                desc: e.recipientName
                  ? `${e.recipientName} (${e.recipientEmail})`
                  : e.recipientEmail,
              },
              {
                term: "청구",
                desc: `${e.receivableCount}건 · ${formatKrw(e.totalAmount)}`,
              },
              {
                term: "거래처",
                desc:
                  e.customerNames.length > 0 ? e.customerNames.join(", ") : "—",
              },
            ]}
          />
          {e.errorMessage && (
            <p className="text-xs text-vermilion">! {e.errorMessage}</p>
          )}
          {i < entries.length - 1 && <Divider />}
        </div>
      ))}
    </div>
  );
}

function InsightsList({ entries }: { entries: InsightsBatchEntry[] }) {
  return (
    <div className="space-y-5">
      {entries.map((e, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-ink">{fmtTime(e.collectedAt)}</span>
            <span className="text-[11px] text-muted">
              {e.videoCount}건 수집
            </span>
          </div>
          {e.sampleTitles.length > 0 && (
            <ul className="space-y-1 text-xs text-muted">
              {e.sampleTitles.map((title, j) => (
                <li key={j} className="truncate">
                  ▸ {title}
                </li>
              ))}
            </ul>
          )}
          {i < entries.length - 1 && <Divider />}
        </div>
      ))}
    </div>
  );
}

type Props = {
  label: string;
  loading: boolean;
  error: string | null;
  log: JobRunLog | null;
};

export function AutomationLogPanel({ label, loading, error, log }: Props) {
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h3 className="text-sm font-semibold text-ink">{label}</h3>
        <p className="text-xs text-muted">실행 로그 · 최근 20건</p>
      </header>
      <Divider />
      {loading ? (
        <p className="text-xs text-muted">불러오는 중…</p>
      ) : error ? (
        <p className="text-xs text-vermilion">{error}</p>
      ) : !log || log.entries.length === 0 ? (
        <p className="text-xs text-muted">실행 기록이 없습니다.</p>
      ) : (
        <Section title="실행 이력">
          {log.kind === "deposit-match" && (
            <DepositMatchList entries={log.entries} />
          )}
          {log.kind === "mail-operator" && (
            <MailOperatorList entries={log.entries} />
          )}
          {log.kind === "insights" && <InsightsList entries={log.entries} />}
        </Section>
      )}
    </div>
  );
}
