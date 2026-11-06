"use client";

import { ModalShell } from "@/components/common/ModalShell";
import type {
  RefreshHistoryItem,
  RequestStatus,
} from "@/features/sms-sender/status-refresh/contract";
import { kstFormat } from "@/lib/kst-format";

type Props = {
  items: RefreshHistoryItem[];
  loadError: string | null;
  onClose: () => void;
};

const MDHM = kstFormat({
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "대기 중",
  running: "진행 중",
  done: "완료",
  failed: "실패",
};

const STATUS_TONE: Record<RequestStatus, string> = {
  pending: "text-muted",
  running: "text-muted",
  done: "text-ink",
  failed: "text-vermilion",
};

const STEP_STATUS_LABEL: Record<
  RefreshHistoryItem["steps"][number]["status"],
  string
> = { ok: "성공", failed: "실패", skipped: "건너뜀" };

/** `11.07 10:02` — 이력은 최근 5건이라 연도가 없어도 헷갈리지 않는다. */
function shortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    MDHM.formatToParts(d).find((p) => p.type === type)?.value ?? "";
  return `${part("month")}.${part("day")} ${part("hour")}:${part("minute")}`;
}

function HistoryEntry({ item }: { item: RefreshHistoryItem }) {
  return (
    <li className="border-b border-line-soft py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="tabular-nums text-ink">
          {shortTime(item.requestedAt)}
        </span>
        <span className="text-muted" aria-hidden>
          ·
        </span>
        <span className="text-ink-soft">{item.requester}</span>
        <span className={`font-medium ${STATUS_TONE[item.status]}`}>
          {STATUS_LABEL[item.status]}
        </span>
      </div>
      {item.note && <p className="mt-1 text-sm text-vermilion">{item.note}</p>}
      {item.steps.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {item.steps.map((s, i) => (
            <li key={i}>
              <span className="text-ink">{s.label}</span>{" "}
              <span
                className={
                  s.status === "ok" ? "text-ink-soft" : "text-vermilion"
                }
              >
                {STEP_STATUS_LABEL[s.status]}
              </span>
              {s.summary && (
                <span className="ml-2 text-ink-soft">{s.summary}</span>
              )}
              {s.action && (
                <p className="mt-0.5 text-xs text-vermilion">{s.action}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {item.changes.length > 0 && (
        <div className="mt-2 text-sm">
          <p className="text-xs font-medium text-muted">바뀐 점</p>
          <ul className="mt-1 list-disc pl-5 text-ink-soft">
            {item.changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

/** 현황 최신화 이력 — 언제·누가·단계별 결과·바뀐 점. 실패는 사람이 할 일로 적힌다. */
export function RefreshHistoryModal({ items, loadError, onClose }: Props) {
  return (
    <ModalShell title="최신화 이력" size="xl" onClose={onClose}>
      {loadError ? (
        <p role="alert" className="text-sm text-vermilion">
          {loadError}
        </p>
      ) : items.length === 0 ? (
        <p className="bg-situation-bg px-3 py-8 text-center text-sm text-muted">
          아직 최신화한 적이 없습니다.
        </p>
      ) : (
        <ul>
          {items.map((item) => (
            <HistoryEntry key={item.id} item={item} />
          ))}
        </ul>
      )}
    </ModalShell>
  );
}
