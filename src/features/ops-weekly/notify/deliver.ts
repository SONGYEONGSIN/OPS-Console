import "server-only";

import { reportSender } from "@/features/automations/report-send";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { sendTeamsChatMessage } from "@/lib/microsoft/teams";
import type { Mail } from "./mail";
import {
  deliveredRecipients,
  recordNotices,
  type NoticeKind,
  type NoticeRow,
} from "./store";

export type NoticeTarget = {
  weekId: string;
  kind: NoticeKind;
  /** 중복 막는 열쇠 — 같은 슬롯에 이미 보낸 사람은 건너뛴다 */
  slot: string;
  mails: readonly { from: string; to: string; mail: Mail }[];
  teams?: { chatId: string; html: string };
};

export type NoticeTally = {
  sent: number;
  failed: number;
  dryRun: number;
  skipped: number;
  errors: string[];
};

type Outcome = Pick<NoticeRow, "status" | "error">;

export function notifyDryRun(): boolean {
  return (process.env.OPS_WEEKLY_NOTIFY_DRY_RUN ?? "").toLowerCase() === "true";
}

async function sendMail(m: NoticeTarget["mails"][number]): Promise<Outcome> {
  const res = await sendGraphMail({
    senderUserId: m.from,
    toEmail: m.to,
    subject: m.mail.subject,
    html: m.mail.html,
  });
  return res.ok
    ? { status: "sent", error: null }
    : { status: "failed", error: res.error };
}

async function sendTeams(t: NonNullable<NoticeTarget["teams"]>): Promise<Outcome> {
  try {
    await sendTeamsChatMessage({
      operatorEmail: reportSender(),
      chatId: t.chatId,
      html: t.html,
    });
    return { status: "sent", error: null };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 메일·Teams 를 보내고 이력을 남긴다. 한 사람이 실패해도 다음 사람은 계속 보낸다(던지지 않는다).
 * 이력 저장 실패만 던진다 — 기록 없이 보내면 다음 호출이 또 보낸다.
 */
export async function deliverNotices(t: NoticeTarget): Promise<NoticeTally> {
  const done = await deliveredRecipients(t.weekId, t.slot);
  const dry = notifyDryRun();
  const tally: NoticeTally = { sent: 0, failed: 0, dryRun: 0, skipped: 0, errors: [] };
  const rows: NoticeRow[] = [];
  const teams = t.teams;
  const jobs: { recipient: string; send: () => Promise<Outcome> }[] = [
    ...t.mails.map((m) => ({ recipient: m.to, send: () => sendMail(m) })),
    ...(teams
      ? [{ recipient: `teams:${teams.chatId}`, send: () => sendTeams(teams) }]
      : []),
  ];
  for (const job of jobs) {
    if (done.has(job.recipient)) {
      tally.skipped += 1;
      continue;
    }
    const out: Outcome = dry ? { status: "dry_run", error: null } : await job.send();
    if (out.status === "sent") tally.sent += 1;
    else if (out.status === "dry_run") tally.dryRun += 1;
    else {
      tally.failed += 1;
      tally.errors.push(`${job.recipient}: ${out.error ?? "알 수 없음"}`);
    }
    rows.push({
      week_id: t.weekId,
      kind: t.kind,
      slot: t.slot,
      recipient: job.recipient,
      ...out,
    });
  }
  if (rows.length > 0) await recordNotices(rows);
  return tally;
}
