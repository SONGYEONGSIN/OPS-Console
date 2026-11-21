import "server-only";

import { listPendingWriters } from "../report-queries";
import type { WeekRow } from "../schemas";
import { kstYmd, weekOf, weekRefFromStart } from "../week";
import { ensureWeek, listWriters } from "../week-queries";
import { deliverNotices, type NoticeTally } from "./deliver";
import {
  remindMail,
  requestMail,
  requestTeamsHtml,
  type NoticeWeek,
} from "./mail";

export type SendOutcome =
  | { kind: "sent"; tally: NoticeTally; teams?: "set" | "unset" }
  | { kind: "skipped"; reason: string }
  | { kind: "failed"; reason: string };

type WeekLite = Pick<WeekRow, "id" | "week_start" | "status">;

/** 메일 링크의 주소 — 다른 공유 링크(뉴스레터·배정 보고)와 같은 env. */
export function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.FOLIO_BASE_URL ??
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export function noticeWeekOf(weekStart: string): NoticeWeek {
  const ref = weekRefFromStart(weekStart);
  return {
    weekStart,
    label: ref?.label ?? weekStart,
    rangeLabel: ref?.rangeLabel ?? "",
  };
}

const KST_HOUR = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  hourCycle: "h23",
});

/** 목 12:00 · 17:00 두 번 — 같은 반나절에 두 번 불려도 한 번만 나가게 날짜·반나절로 묶는다. */
export function remindSlotOf(now: Date): string {
  const hour = Number(KST_HOUR.format(now));
  return `remind:${kstYmd(now)}:${hour < 15 ? "noon" : "evening"}`;
}

async function currentWeek(now: Date): Promise<WeekLite | null> {
  return ensureWeek(weekOf(now).weekStart, now);
}

/** 수 10:00 — 이번 주 작성자 전원(본인 메일함 → 본인) + Teams 그룹채팅. */
export async function sendRequest(now: Date): Promise<SendOutcome> {
  const week = await currentWeek(now);
  if (week === null) return { kind: "failed", reason: "이번 주 보고서를 열지 못했습니다" };
  if (week.status !== "open") return { kind: "skipped", reason: "이미 보고된 주입니다" };
  const writers = await listWriters();
  if (writers.length === 0) {
    return { kind: "failed", reason: "작성 대상 명단이 비어 있습니다" };
  }
  const w = noticeWeekOf(week.week_start);
  const base = appBaseUrl();
  const chatId = process.env.OPS_WEEKLY_TEAMS_CHAT_ID;
  const mail = requestMail(w, base);
  const tally = await deliverNotices({
    weekId: week.id,
    kind: "request",
    slot: "request",
    mails: writers.map((x) => ({ from: x.email, to: x.email, mail })),
    teams: chatId ? { chatId, html: requestTeamsHtml(w, base) } : undefined,
  });
  return { kind: "sent", tally, teams: chatId ? "set" : "unset" };
}

/**
 * 미제출자 알림 — 시각 잡(목 12:00·17:00)과 당번의 [미제출자에게 알림]이 같이 쓴다.
 * 수동은 보는 주와 슬롯을 넘긴다(누를 때마다 새 슬롯).
 */
export async function sendRemind(
  now: Date,
  manual?: { week: WeekLite; slot: string },
): Promise<SendOutcome> {
  const week = manual?.week ?? (await currentWeek(now));
  if (week === null) return { kind: "failed", reason: "이번 주 보고서를 열지 못했습니다" };
  if (week.status !== "open") return { kind: "skipped", reason: "이미 보고된 주입니다" };
  const pending = await listPendingWriters(week.id);
  if (pending.length === 0) return { kind: "skipped", reason: "모두 제출했습니다" };
  const mail = remindMail(noticeWeekOf(week.week_start), appBaseUrl());
  const tally = await deliverNotices({
    weekId: week.id,
    kind: "remind",
    slot: manual?.slot ?? remindSlotOf(now),
    mails: pending.map((x) => ({ from: x.email, to: x.email, mail })),
  });
  return { kind: "sent", tally };
}
