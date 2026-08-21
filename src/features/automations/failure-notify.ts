import { kstFormat } from "@/lib/kst-format";
import type { AutomationRunEntry } from "./types";

/**
 * 자동화 실패 즉시 알림 — 판정과 렌더 (순수). 발송은 report-send.ts.
 *
 * 소음 억제가 핵심이다. 입금 매칭은 매시간 돌아서, 장애가 하루 이어지면 같은 실패로
 * 24통이 온다. 그래서 **직전 실행도 실패였으면 다시 보내지 않는다** — 첫 실패만 알리고,
 * 지속 중인 장애는 일일 보고가 매일 상기시킨다.
 */

/**
 * `recent`는 해당 잡의 최신순 실행 기록(첫 원소 = 방금 기록한 이번 실행).
 * skipped(자동 실행 OFF로 건너뛴 호출)는 실행으로 치지 않는다 — 사이에 끼었다고
 * '직전 실패' 판정이 흐려지면 억제가 무력해진다.
 */
export function shouldNotifyFailure(recent: AutomationRunEntry[]): boolean {
  const [current, previous] = recent.filter((r) => !r.skipped);
  if (!current || current.ok) return false;
  return !previous || previous.ok;
}

const KST = "Asia/Seoul";

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return kstFormat({
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderFailureHtml(
  label: string,
  entry: AutomationRunEntry,
): string {
  return (
    `<p><b>⚠ ${escapeHtml(label)} 실패</b></p>` +
    `<p>${escapeHtml(entry.message || "사유 없음")}</p>` +
    `<p>${escapeHtml(formatTime(entry.ranAt))}</p>` +
    `<blockquote><p>자동화가 실패하면 바로 알려드려요.<br>` +
    `같은 실패가 이어지면 처음 한 번만 보냅니다.</p></blockquote>`
  );
}
