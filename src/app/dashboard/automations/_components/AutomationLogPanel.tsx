"use client";

import { useState, useTransition } from "react";
import {
  Section,
  DefList,
  Divider,
} from "@/app/dashboard/_components/inspector/list-variants/shared";
import {
  formatKrw,
  type JobRunLog,
  type DepositMatchEntry,
  type DepositMismatchItem,
  type MailOperatorEntry,
  type InsightsBatchEntry,
  type SmileEdiEntry,
  type ServiceNoticeEntry,
} from "@/features/automations/run-logs-normalize";
import { applyMismatchAsMatch } from "@/features/receivables-match/apply-mismatch-action";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR");
}

/**
 * 불일치(금액 일치·이름 불일치) 승인 버튼 — automations 페이지는 admin 전용이라
 * 항상 노출. 클릭 시 alias 학습 + 즉시 매칭(서버 액션이 admin 재검증).
 */
function MismatchApplyButton({ item }: { item: DepositMismatchItem }) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);

  if (done) {
    return <span className="shrink-0 text-[11px] text-muted">{done}</span>;
  }
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            const r = await applyMismatchAsMatch({
              misuRow: item.misuRow,
              depRow: item.depRow,
              misuCustomer: item.misuCustomer,
              depContent: item.depContent,
            });
            setDone(r.ok ? (r.patched ? "✓ 적용됨" : "✓ 학습됨") : "실패");
          } catch {
            setDone("실패");
          }
        })
      }
      className="shrink-0 border border-ink px-2 py-0.5 text-[11px] text-ink transition-colors hover:bg-ink hover:text-cream disabled:opacity-50"
    >
      {pending ? "적용 중…" : "적용"}
    </button>
  );
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
          {e.mismatchItems.length > 0 && (
            <ul className="space-y-1 text-xs text-vermilion-deep">
              {e.mismatchItems.map((item, j) => (
                <li key={j} className="flex items-start justify-between gap-2">
                  <span>▸ {item.line}</span>
                  <MismatchApplyButton item={item} />
                </li>
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

function SmileEdiList({ entries }: { entries: SmileEdiEntry[] }) {
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
                term: "역발행",
                desc: `${e.invoiceCount}건 · ${formatKrw(e.totalSupplyAmount)}`,
              },
              {
                term: "거래처",
                desc:
                  e.companyNames.length > 0 ? e.companyNames.join(", ") : "—",
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

function ServiceNoticeList({ entries }: { entries: ServiceNoticeEntry[] }) {
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
              { term: "대상월", desc: e.targetMonth },
              { term: "서비스", desc: `${e.serviceCount}건` },
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
          {log.kind === "smileedi" && <SmileEdiList entries={log.entries} />}
          {log.kind === "service-notice" && (
            <ServiceNoticeList entries={log.entries} />
          )}
          {log.kind === "insights" && <InsightsList entries={log.entries} />}
        </Section>
      )}
    </div>
  );
}
