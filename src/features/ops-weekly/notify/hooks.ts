import "server-only";

import { recordAutomationRun } from "@/features/automations/run-recorder";
import type { OpsWeeklyEvent, OpsWeeklyHook } from "../events";
import { listRecipients } from "../settings-queries";
import { deliverNotices, type NoticeTarget } from "./deliver";
import { allSubmittedMail, reportedMail, returnedMail } from "./mail";
import { operatorNameOf } from "./operator-name";
import { toRunResult } from "./run-result";
import { appBaseUrl, noticeWeekOf } from "./run";

/** 이벤트 발송 실행 기록의 잡 id — 레지스트리 잡이 아니라 실패 즉시 알림·일일 보고에 잡히게 하는 자리다. */
export const NOTIFY_JOB_ID = "ops-weekly-notify";

/** 보내고 기록한다. 실패가 있으면 던진다 — 호출한 action 은 막지 않지만(emit 이 잡는다) 기록에는 남는다. */
async function deliverAndRecord(label: string, target: NoticeTarget): Promise<void> {
  const tally = await deliverNotices(target);
  const result = toRunResult(label, { kind: "sent", tally });
  await recordAutomationRun(NOTIFY_JOB_ID, { ok: result.ok, message: result.message });
  if (!result.ok) throw new Error(result.message);
}

async function failAndRecord(message: string): Promise<never> {
  await recordAutomationRun(NOTIFY_JOB_ID, { ok: false, message });
  throw new Error(message);
}

async function onAllSubmitted(ev: Extract<OpsWeeklyEvent, { type: "all-submitted" }>) {
  const label = "전원 제출 알림";
  if (ev.dutyEmail === null) {
    return failAndRecord(`${label} — 당번이 지정되지 않아 보내지 못했습니다`);
  }
  const mail = allSubmittedMail(noticeWeekOf(ev.weekStart), appBaseUrl());
  await deliverAndRecord(label, {
    weekId: ev.weekId,
    kind: "all-submitted",
    // 다시 작성 → 재제출로 또 전원이 되면 당번은 다시 알아야 한다 — 매번 새 슬롯.
    slot: `all-submitted:${new Date().toISOString()}`,
    mails: [{ from: ev.dutyEmail, to: ev.dutyEmail, mail }],
  });
}

async function onReturned(ev: Extract<OpsWeeklyEvent, { type: "report-returned" }>) {
  const by = await operatorNameOf(ev.returnedBy);
  const mail = returnedMail(noticeWeekOf(ev.weekStart), appBaseUrl(), {
    reason: ev.reason,
    by,
  });
  await deliverAndRecord("다시 작성 요청 알림", {
    weekId: ev.weekId,
    kind: "returned",
    slot: `returned:${ev.operatorEmail}:${new Date().toISOString()}`,
    mails: [{ from: ev.returnedBy, to: ev.operatorEmail, mail }],
  });
}

async function onReported(ev: Extract<OpsWeeklyEvent, { type: "week-reported" }>) {
  const label = "최종 보고 메일";
  // 정정 뒤 다시 보고는 메일을 다시 보내지 않는다(설계 §4 잠금).
  if (ev.correction) return;
  const recipients = await listRecipients();
  if (recipients.length === 0) {
    return failAndRecord(`${label} — 받는 사람이 없어 보내지 못했습니다(관리 › 받는 사람)`);
  }
  const by = await operatorNameOf(ev.reportedBy);
  const mail = reportedMail(noticeWeekOf(ev.weekStart), appBaseUrl(), { by });
  await deliverAndRecord(label, {
    weekId: ev.weekId,
    kind: "reported",
    slot: "reported",
    mails: recipients.map((to) => ({ from: ev.reportedBy, to, mail })),
  });
}

export const NOTIFY_HOOKS: readonly OpsWeeklyHook[] = [
  {
    name: "notify",
    handle: async (ev) => {
      if (ev.type === "all-submitted") return onAllSubmitted(ev);
      if (ev.type === "report-returned") return onReturned(ev);
      return onReported(ev);
    },
  },
];
