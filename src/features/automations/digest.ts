import { kstFormat } from "@/lib/kst-format";
import type { AutomationCadence, AutomationRunEntry } from "./types";

/**
 * 자동화 일일 보고 — 잡별 상태 판정과 메시지 렌더 (순수).
 *
 * 즉시 실패 알림이 못 잡는 구멍을 메우는 게 목적이다: 잡이 **아예 안 돌면** 실패 이벤트
 * 자체가 없어 알림이 뜰 수가 없다(스케줄러 죽음·회사 PC 꺼짐). 그래서 '오늘 무슨 일이
 * 있었나'가 아니라 '마지막 실행이 주기에 비해 너무 오래됐나'로 판정한다.
 */

export type DigestStatus =
  "failed" | "stale" | "skipped" | "off" | "ok" | "idle";

export type DigestJobState = {
  jobId: string;
  label: string;
  status: DigestStatus;
  lastRunAt: string | null;
  runCount: number;
  failCount: number;
  message: string;
};

export type DigestInput = {
  job: {
    id: string;
    label: string;
    cadence: AutomationCadence;
    manualOnly?: boolean;
  };
  enabled: boolean;
  lastRunAt: string | null;
  /** 오늘(KST) 이 잡의 실행 기록. */
  todayRuns: AutomationRunEntry[];
};

/**
 * 주기별 '이 정도 안 돌면 이상하다' 임계(시간).
 *
 * 실행 예정 시각을 계산하지 않고 임계로만 보는 이유 — 격주 게이트·공휴일·수동 재실행 때문에
 * 예정 시각 대비 판정은 오탐이 잦다. weekday는 금→월 공백(72h)을 넘겨야 하므로 96h.
 */
const STALE_AFTER_HOURS: Record<AutomationCadence, number | null> = {
  hourly: 3,
  weekday: 96,
  daily: 48,
  weekly: 216,
  monthly: 840,
  manual: null,
};

const HOUR_MS = 60 * 60 * 1000;

/** 문제 건이 먼저 보이도록. 같은 등급 안에서는 입력 순서(=registry 순서)를 지킨다. */
const STATUS_ORDER: Record<DigestStatus, number> = {
  failed: 0,
  stale: 1,
  skipped: 2,
  off: 3,
  ok: 4,
  idle: 5,
};

function isStale(
  cadence: AutomationCadence,
  lastRunAt: string | null,
  now: Date,
): boolean {
  const limit = STALE_AFTER_HOURS[cadence];
  if (limit === null) return false;
  if (!lastRunAt) return true;
  const last = new Date(lastRunAt).getTime();
  if (Number.isNaN(last)) return true;
  return now.getTime() - last > limit * HOUR_MS;
}

function stateOf(input: DigestInput, now: Date): DigestJobState {
  const { job, enabled, lastRunAt, todayRuns } = input;
  const actual = todayRuns.filter((r) => !r.skipped);
  const failures = actual.filter((r) => !r.ok);
  const base = {
    jobId: job.id,
    label: job.label,
    lastRunAt,
    runCount: actual.length,
    failCount: failures.length,
  };

  if (failures.length > 0) {
    const latest = [...failures].sort((a, b) =>
      b.ranAt.localeCompare(a.ranAt),
    )[0];
    return { ...base, status: "failed", message: latest.message };
  }
  if (actual.length > 0) return { ...base, status: "ok", message: "" };
  if (todayRuns.length > 0)
    return { ...base, status: "skipped", message: todayRuns[0].message };

  // 오늘 기록이 없는 경우 — 안 돌아도 되는 잡인지부터 가린다.
  if (!enabled && !job.manualOnly)
    return { ...base, status: "off", message: "자동 실행 꺼짐" };
  if (!isStale(job.cadence, lastRunAt, now))
    return { ...base, status: "idle", message: "" };
  return {
    ...base,
    status: "stale",
    message: lastRunAt ? "예정 주기를 넘도록 실행 없음" : "실행 기록 없음",
  };
}

export function buildDigest(
  inputs: DigestInput[],
  now: Date,
): DigestJobState[] {
  return inputs
    .map((input) => stateOf(input, now))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

// ── 렌더 ────────────────────────────────────────────────────────────────

const KST = "Asia/Seoul";

function formatDate(iso: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST,
    month: "2-digit",
    day: "2-digit",
  }).format(iso);
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return kstFormat({
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * 두 시각이 같은 KST 날짜인가 — '오늘 실행분' 추림에 쓴다.
 *
 * 서버는 UTC로 돌고 기록도 UTC로 들어오는데, 하루 경계는 KST여야 한다. UTC 기준으로
 * 자르면 오전 9시 이전 실행이 전날로 밀린다.
 */
export function isSameKstDay(iso: string, now: Date): boolean {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return false;
  const day = (x: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: KST }).format(x);
  return day(d) === day(now);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PROBLEM_LABEL: Partial<Record<DigestStatus, string>> = {
  failed: "실패",
  stale: "미실행",
};

function problemRows(states: DigestJobState[]): string {
  const rows = states
    .filter((s) => s.status === "failed" || s.status === "stale")
    .map((s) => {
      const when =
        s.status === "failed"
          ? formatTime(s.lastRunAt)
          : `마지막 ${formatTime(s.lastRunAt)}`;
      return (
        `<tr><td>${escapeHtml(PROBLEM_LABEL[s.status] ?? "")}</td>` +
        `<td>${escapeHtml(s.label)}</td>` +
        `<td>${escapeHtml(when)}</td>` +
        `<td>${escapeHtml(s.message)}</td></tr>`
      );
    });
  if (rows.length === 0) return "";
  return (
    `<table border="1" cellpadding="6" cellspacing="0">` +
    `<tr><th>구분</th><th>자동화</th><th>시각</th><th>내용</th></tr>` +
    rows.join("") +
    `</table>`
  );
}

function okLine(states: DigestJobState[]): string {
  const ok = states.filter((s) => s.status === "ok");
  if (ok.length === 0) return "";
  const parts = ok.map((s) =>
    s.runCount > 1
      ? `${escapeHtml(s.label)}(${s.runCount})`
      : escapeHtml(s.label),
  );
  return `<p>정상: ${parts.join(" · ")}</p>`;
}

function footerHtml(): string {
  return (
    `<blockquote><p>자동화 실행 결과를 하루 한 번 모아 알려드려요.<br>` +
    `실패는 발생 즉시 따로 알림이 갑니다.</p></blockquote>`
  );
}

export function renderDigestHtml(states: DigestJobState[], now: Date): string {
  const count = (s: DigestStatus) =>
    states.filter((x) => x.status === s).length;
  const summary = [
    `정상 ${count("ok")}`,
    `실패 ${count("failed")}`,
    `미실행 ${count("stale")}`,
    `건너뜀 ${count("skipped")}`,
    `꺼짐 ${count("off")}`,
  ].join(" · ");

  const problems = problemRows(states);
  const body = problems === "" ? `<p>이상 없음.</p>` : problems;

  return (
    `<h3>[운영부 상황실] 자동화 일일 보고 — ${formatDate(now)}</h3>` +
    `<p>${summary}</p>` +
    body +
    okLine(states) +
    footerHtml()
  );
}
