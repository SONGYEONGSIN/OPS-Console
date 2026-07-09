import "server-only";
import { fetchReceivablesSheet } from "./queries";
import { groupRecipientsByOwner, groupOwnerByOperator } from "./mail-grouping";
import type {
  ReminderGroup,
  OperatorReminderGroup,
  ExcludedReason,
} from "./mail-schemas";

export type ReminderPreview = {
  thresholdDays: number;
  groups: ReminderGroup[];
  excluded: ExcludedReason[];
  sheetAvailable: boolean;
  worksheetName?: string;
};

const DEFAULT_THRESHOLD_DAYS = 10;

/** 독려 대상 경과일수 임계값 — 미리보기/발송이 동일 기준을 쓰도록 공유. */
export function readThresholdDays(): number {
  return readThreshold();
}

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

  const { groups, excluded } = groupRecipientsByOwner(
    sheet,
    thresholdDays,
    now,
  );
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
  /**
   * 해당 학교담당자의 (담당 운영자별) 그룹 목록. 운영자가 여러 명이면 N개 —
   * 각 그룹이 해당 운영자 메일박스에서 1통씩 발송된다.
   */
  groups: OperatorReminderGroup[];
  /** 운영자 이메일 매핑 실패 등으로 발송에서 제외된 행 (해당 학교담당자 건만) */
  blocked: ExcludedReason[];
};

/**
 * 인스펙터에서 호출 — 특정 학교담당자 이메일에 묶이는 그룹 데이터를 조회.
 * 같은 이메일이라도 담당 운영자가 다르면 별도 그룹으로 분리된다(발신 메일박스가 다름).
 * (호출자가 단건/묶음 선택 UI를 표시)
 */
export async function findGroupForEmail(
  targetEmail: string,
  now: Date = new Date(),
): Promise<FindGroupForEmailResult> {
  const thresholdDays = readThreshold();
  const sheet = await fetchReceivablesSheet();
  if (!sheet) {
    return { thresholdDays, sheetAvailable: false, groups: [], blocked: [] };
  }
  const { groups, blocked } = groupOwnerByOperator(sheet, thresholdDays, now);
  const normalized = targetEmail.trim().toLowerCase();
  return {
    thresholdDays,
    sheetAvailable: true,
    groups: groups.filter(
      (g) => g.recipient.email.toLowerCase() === normalized,
    ),
    blocked: blocked.filter(
      (b) => b.recipientEmail?.toLowerCase() === normalized,
    ),
  };
}
