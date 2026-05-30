import "server-only";
import { fetchReceivablesSheet } from "./queries";
import { groupRecipientsByOwner } from "./mail-grouping";
import type { ReminderGroup, ExcludedReason } from "./mail-schemas";

export type ReminderPreview = {
  thresholdDays: number;
  groups: ReminderGroup[];
  excluded: ExcludedReason[];
  sheetAvailable: boolean;
  worksheetName?: string;
};

const DEFAULT_THRESHOLD_DAYS = 10;

function readThreshold(): number {
  const raw = process.env.MAIL_REMINDER_THRESHOLD_DAYS;
  if (!raw) return DEFAULT_THRESHOLD_DAYS;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : DEFAULT_THRESHOLD_DAYS;
}

/**
 * 학교담당자 독려 메일 미리보기 — Excel sheet fetch + 그룹화.
 * UI 모달에서 발송 전 표시 용도.
 */
export async function previewReminderRecipients(
  now: Date = new Date(),
): Promise<ReminderPreview> {
  const thresholdDays = readThreshold();
  const sheet = await fetchReceivablesSheet();
  if (!sheet) {
    return {
      thresholdDays,
      groups: [],
      excluded: [],
      sheetAvailable: false,
    };
  }

  const { groups, excluded } = groupRecipientsByOwner(sheet, thresholdDays, now);
  return {
    thresholdDays,
    groups,
    excluded,
    sheetAvailable: true,
    worksheetName: sheet.worksheetName,
  };
}

export type FindGroupForEmailResult = {
  thresholdDays: number;
  sheetAvailable: boolean;
  /** 해당 이메일이 학교담당자 컬럼에 있고 임계값 이상인 경우의 그룹. 없으면 null */
  group: ReminderGroup | null;
};

/**
 * 인스펙터에서 호출 — 특정 학교담당자 이메일에 묶이는 그룹 데이터를 조회.
 * 같은 이메일로 묶이는 다른 미수 청구건이 있으면 모두 group.items 에 포함된다.
 * (호출자가 단건/묶음 선택 UI를 표시)
 */
export async function findGroupForEmail(
  targetEmail: string,
  now: Date = new Date(),
): Promise<FindGroupForEmailResult> {
  const thresholdDays = readThreshold();
  const sheet = await fetchReceivablesSheet();
  if (!sheet) {
    return { thresholdDays, sheetAvailable: false, group: null };
  }
  const { groups } = groupRecipientsByOwner(sheet, thresholdDays, now);
  const normalized = targetEmail.trim().toLowerCase();
  const group =
    groups.find((g) => g.recipient.email.toLowerCase() === normalized) ?? null;
  return { thresholdDays, sheetAvailable: true, group };
}
