"use client";

import { useState, useTransition } from "react";
import {
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
  type NoticeTeamsEntry,
  type ClosingRunEntry,
  type WeeklyReportEntry,
} from "@/features/automations/run-logs-normalize";
import type { AutomationRunEntry } from "@/features/automations/types";
import { applyMismatchAsMatch } from "@/features/receivables-match/apply-mismatch-action";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR");
}

/** ISO 시각을 KST(Asia/Seoul) 기준 YYYY-MM-DD로. cron은 보통 1일 1회라 날짜 키가 안전. */
function kstDateKey(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // en-CA 로케일은 YYYY-MM-DD 형식을 반환
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
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

function NoticeTeamsList({ entries }: { entries: NoticeTeamsEntry[] }) {
  return (
    <div className="space-y-5">
      {entries.map((e, i) => (
        <div key={i} className="space-y-2">
          <span className="text-xs text-ink">{fmtTime(e.sharedAt)}</span>
          <DefList
            items={[
              { term: "공지", desc: `[공지] ${e.title}` },
              { term: "작성자", desc: e.author },
            ]}
          />
          {i < entries.length - 1 && <Divider />}
        </div>
      ))}
    </div>
  );
}

const WEEKLY_STATUS_LABEL: Record<WeeklyReportEntry["status"], string> = {
  created: "생성",
  skipped: "스킵",
  dry_run: "DRY-RUN",
  failed: "실패",
};

function WeeklyStatusBadge({
  status,
}: {
  status: WeeklyReportEntry["status"];
}) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[11px] ${
        status === "failed"
          ? "bg-vermilion/20 text-vermilion-deep"
          : status === "created"
            ? "bg-washi-raised text-ink"
            : "bg-washi-raised text-muted"
      }`}
    >
      {WEEKLY_STATUS_LABEL[status]}
    </span>
  );
}

function WeeklyReportList({ entries }: { entries: WeeklyReportEntry[] }) {
  return (
    <div className="space-y-5">
      {entries.map((e, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-ink">{fmtTime(e.ranAt)}</span>
            <WeeklyStatusBadge status={e.status} />
          </div>
          <DefList
            items={[
              {
                term: "회차",
                desc:
                  e.year && e.month && e.week
                    ? `${e.year}년 ${e.month}월 ${e.week}주차`
                    : "—",
              },
              { term: "발송자", desc: e.sender ?? "—" },
              { term: "파일", desc: e.fileName ?? "—" },
              {
                term: "Teams",
                desc:
                  e.status === "created"
                    ? e.teamsSent
                      ? "발송"
                      : "미발송"
                    : "—",
              },
            ]}
          />
          <p className="text-xs text-muted">{e.message}</p>
          {i < entries.length - 1 && <Divider />}
        </div>
      ))}
    </div>
  );
}

const CLOSING_STATUS_LABEL: Record<ClosingRunEntry["status"], string> = {
  success: "성공",
  skipped: "off주",
  failed: "실패",
};

function ClosingStatusBadge({ status }: { status: ClosingRunEntry["status"] }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[11px] ${
        status === "failed"
          ? "bg-vermilion/20 text-vermilion-deep"
          : status === "success"
            ? "bg-washi-raised text-ink"
            : "bg-washi-raised text-muted"
      }`}
    >
      {CLOSING_STATUS_LABEL[status]}
    </span>
  );
}

function ClosingScrapeList({ entries }: { entries: ClosingRunEntry[] }) {
  return (
    <div className="space-y-5">
      {entries.map((e, i) => (
        <div key={i} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-ink">{fmtTime(e.ranAt)}</span>
            <ClosingStatusBadge status={e.status} />
          </div>
          <DefList
            items={[
              {
                term: "적재",
                desc: e.status === "success" ? `${e.serviceCount}건 마감` : "—",
              },
            ]}
          />
          {e.message && (
            <p
              className={`text-xs ${e.status === "failed" ? "text-vermilion" : "text-muted"}`}
            >
              {e.status === "failed" ? "! " : ""}
              {e.message}
            </p>
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

function RunStatusBadge({ entry }: { entry: AutomationRunEntry }) {
  const label = entry.skipped ? "스킵" : entry.ok ? "성공" : "실패";
  return (
    <span
      className={`inline-block px-2 py-0.5 text-[11px] ${
        !entry.ok
          ? "bg-vermilion/20 text-vermilion-deep"
          : entry.skipped
            ? "bg-washi-raised text-muted"
            : "bg-washi-raised text-ink"
      }`}
    >
      {label}
    </span>
  );
}

/**
 * 발송 상세 entry들의 시각 필드를 인덱스 순서대로 추출 — kind마다 필드명이 달라
 * (deposit-match=startedAt, *메일=sentAt, run계열=ranAt, insights=collectedAt)
 * union narrowing으로 타입 단언 없이 통일한다.
 */
function entrySentAtList(log: JobRunLog): string[] {
  switch (log.kind) {
    case "deposit-match":
      return log.entries.map((e) => e.startedAt);
    case "mail-operator":
    case "smileedi":
    case "service-notice":
      return log.entries.map((e) => e.sentAt);
    case "notice-teams":
      return log.entries.map((e) => e.sharedAt);
    case "closing-scrape":
    case "weekly-report":
      return log.entries.map((e) => e.ranAt);
    case "insights":
      return log.entries.map((e) => e.collectedAt);
    default:
      return [];
  }
}

/**
 * log.entries에서 kind를 보존하며 부분집합을 골라 다시 JobRunLog 형태로 묶는다.
 * 각 List 컴포넌트가 entries 배열을 그대로 소비하므로 dispatcher가 kind 분기로 재사용.
 */
function DetailEntries({
  log,
  indices,
}: {
  log: JobRunLog;
  indices: number[];
}) {
  switch (log.kind) {
    case "deposit-match":
      return (
        <DepositMatchList entries={indices.map((i) => log.entries[i])} />
      );
    case "mail-operator":
      return (
        <MailOperatorList entries={indices.map((i) => log.entries[i])} />
      );
    case "smileedi":
      return <SmileEdiList entries={indices.map((i) => log.entries[i])} />;
    case "service-notice":
      return (
        <ServiceNoticeList entries={indices.map((i) => log.entries[i])} />
      );
    case "notice-teams":
      return (
        <NoticeTeamsList entries={indices.map((i) => log.entries[i])} />
      );
    case "closing-scrape":
      return (
        <ClosingScrapeList entries={indices.map((i) => log.entries[i])} />
      );
    case "weekly-report":
      return (
        <WeeklyReportList entries={indices.map((i) => log.entries[i])} />
      );
    case "insights":
      return <InsightsList entries={indices.map((i) => log.entries[i])} />;
    default:
      return null;
  }
}

/** 타임라인 1블록 — run(있으면) + 같은 날짜 발송 상세, 또는 run 없는 폴백 상세. */
type TimelineBlock =
  | { kind: "run"; run: AutomationRunEntry; detailIndices: number[] }
  | { kind: "detail-only"; dateKey: string; detailIndices: number[] };

/** ISO 시각 → epoch ms (정렬용). 파싱 실패 시 0. */
function epochMs(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * run과 발송 상세를 하나의 타임라인으로 합쳐 **시각 내림차순(최신 우선)** 정렬한다.
 * 같은 KST 날짜의 상세는 해당 run 블록에 인라인 묶고, 어떤 run에도 매칭 안 된 상세는
 * 자체 시각의 폴백 블록으로 노출(정보 손실 금지). run/폴백 블록을 대표 시각으로 함께 정렬한다.
 */
export function buildTimeline(
  runs: AutomationRunEntry[],
  log: JobRunLog | null,
): TimelineBlock[] {
  const sentAtList = log ? entrySentAtList(log) : [];
  const detailByDate = new Map<string, number[]>();
  sentAtList.forEach((sentAt, i) => {
    const key = kstDateKey(sentAt);
    const list = detailByDate.get(key) ?? [];
    list.push(i);
    detailByDate.set(key, list);
  });
  const consumed = new Set<string>();
  // 대표 시각(ts)을 함께 들고 다니다 마지막에 내림차순 정렬.
  const sortable: { block: TimelineBlock; ts: number }[] = runs.map((run) => {
    const key = kstDateKey(run.ranAt);
    const detailIndices = !consumed.has(key) ? (detailByDate.get(key) ?? []) : [];
    if (detailIndices.length > 0) consumed.add(key);
    return { block: { kind: "run", run, detailIndices }, ts: epochMs(run.ranAt) };
  });
  // 폴백 — 어떤 run에도 매칭되지 않은 발송 상세 날짜를 자체 시각으로 노출.
  for (const [dateKey, indices] of detailByDate) {
    if (consumed.has(dateKey)) continue;
    // 대표 시각 = 해당 날짜 상세 중 가장 늦은 시각.
    const ts = indices.reduce((max, i) => Math.max(max, epochMs(sentAtList[i])), 0);
    sortable.push({ block: { kind: "detail-only", dateKey, detailIndices: indices }, ts });
  }
  return sortable.sort((a, b) => b.ts - a.ts).map((s) => s.block);
}

type Props = {
  label: string;
  loading: boolean;
  error: string | null;
  runs?: AutomationRunEntry[];
  log: JobRunLog | null;
};

export function AutomationLogPanel({
  label,
  loading,
  error,
  runs = [],
  log,
}: Props) {
  // 실행 로그(runs) 밑에 같은 날짜의 발송 상세를 인라인으로 묶은 통합 타임라인.
  const timeline = buildTimeline(runs, log);
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
      ) : timeline.length === 0 ? (
        <p className="text-xs text-muted">실행 기록이 없습니다.</p>
      ) : (
        <div className="space-y-5">
          {timeline.map((block, i) => (
            <div key={i} data-timeline-item className="space-y-3">
              {block.kind === "run" ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-ink">
                      {fmtTime(block.run.ranAt)}
                    </span>
                    <RunStatusBadge entry={block.run} />
                  </div>
                  {block.run.message && (
                    <p
                      className={`text-xs ${block.run.ok ? "text-muted" : "text-vermilion"}`}
                    >
                      {block.run.message}
                    </p>
                  )}
                </div>
              ) : null}
              {log && block.detailIndices.length > 0 && (
                <div
                  className={
                    block.kind === "run" ? "border-l border-line pl-3" : ""
                  }
                >
                  <DetailEntries log={log} indices={block.detailIndices} />
                </div>
              )}
              {i < timeline.length - 1 && <Divider />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
