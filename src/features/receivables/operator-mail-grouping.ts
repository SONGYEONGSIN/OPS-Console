import type { ReceivablesSheet } from "./queries";
import type { ExcludedReason, ReminderItem } from "./mail-schemas";
import { computeElapsedDays } from "./overdue";
import { OPERATOR_TARGET_DAYS } from "./mail-schedule";
import { OPERATORS } from "@/features/auth/operators";

/** 운영자별로 묶인 미수채권 그룹 — 운영자 본인 메일로 발송 단위. */
export type OperatorReminderGroup = {
  operator: { name: string; email: string };
  items: ReminderItem[];
  totalAmount: number;
};

const OPERATOR_NAME_TO_EMAIL: ReadonlyMap<string, string> = new Map(
  OPERATORS.map((o) => [o.name, o.email]),
);

function findCol(headers: string[], regex: RegExp): number {
  return headers.findIndex((h) => regex.test(h));
}

function toNumber(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const cleaned = raw.replace(/,/g, "").trim();
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * 미수채권 시트에서 운영자(F열)별로 청구건을 묶는다.
 * - 경과일수 = 청구일자 기준 오늘까지 일수(인스펙터 elapsedDays와 동일 계산).
 *   `경과일수 >= thresholdDays` + 적요(K열) 비어있음만 포함
 * - 운영자 이름 → 이메일은 OPERATORS 상수 lookup (매칭 실패 시 excluded)
 * - 필수 컬럼(운영자 / 청구일자) 누락 시 빈 결과 + excluded 사유
 *
 * 학교담당자용 groupRecipientsByOwner와 동일 패턴이지만 recipient가 운영자 본인.
 *
 * @param now 경과일수 계산 기준 시각 (테스트 결정성을 위해 주입, 기본 현재)
 */
export function groupReceivablesByOperator(
  sheet: ReceivablesSheet,
  thresholdDays: number,
  now: Date = new Date(),
): { groups: OperatorReminderGroup[]; excluded: ExcludedReason[] } {
  const excluded: ExcludedReason[] = [];

  const opExact = findCol(sheet.headers, /^운영자$/);
  const operatorCol = opExact >= 0 ? opExact : findCol(sheet.headers, /^담당\s*운영자|책임자$/);
  // 경과일수 전용 컬럼은 시트에 없음 — 청구일자로 계산한다(인스펙터와 동일).
  const billingDateCol = findCol(sheet.headers, /^청구\s*일자/);
  // 적요 헤더 실제 표기: "적 요(피드백 내용)" — 공백/괄호 허용.
  const noteCol = findCol(sheet.headers, /적\s*요|피드백|비고/);

  if (operatorCol === -1) {
    excluded.push({ rowIndex: -1, reason: "missing_operator_column" });
  }
  if (billingDateCol === -1) {
    excluded.push({ rowIndex: -1, reason: "missing_billing_date_column" });
  }
  if (operatorCol === -1 || billingDateCol === -1) {
    return { groups: [], excluded };
  }

  const nameCol = findCol(sheet.headers, /거래처명?|학교명?/);
  const detailCol = findCol(sheet.headers, /내역|상세/);
  const amountCol = findCol(sheet.headers, /청구\s*금액|금액/);

  const byOperator = new Map<
    string,
    { operator: { name: string; email: string }; items: ReminderItem[] }
  >();

  for (let i = 0; i < sheet.rowsText.length; i++) {
    const text = sheet.rowsText[i] ?? [];
    const values = sheet.rows[i] ?? [];

    const operatorName = String(text[operatorCol] ?? values[operatorCol] ?? "").trim();
    if (operatorName === "") {
      excluded.push({ rowIndex: i, reason: "operator_not_found" });
      continue;
    }

    const operatorEmail = OPERATOR_NAME_TO_EMAIL.get(operatorName);
    if (!operatorEmail) {
      excluded.push({
        rowIndex: i,
        customerName: nameCol >= 0 ? String(text[nameCol] ?? "") : undefined,
        reason: "operator_email_not_mapped",
      });
      continue;
    }

    // 적요(K열) 비어있지 않은 행은 silent skip — 이미 처리완료
    if (noteCol >= 0) {
      const noteRaw = String(text[noteCol] ?? values[noteCol] ?? "").trim();
      if (noteRaw !== "") continue;
    }

    // 경과일수 = 청구일자 기준 오늘까지 일수 (인스펙터 표시값과 동일)
    const billingText = String(text[billingDateCol] ?? values[billingDateCol] ?? "");
    const daysOverdue = computeElapsedDays(billingText, now);
    if (daysOverdue === null) continue;
    if (daysOverdue < thresholdDays) {
      excluded.push({ rowIndex: i, reason: "below_threshold" });
      continue;
    }
    // 원본 GAS 규칙: 경과일수가 마일스톤(TARGET_DAYS)에 정확히 일치할 때만 발송.
    // 그 외(11~14일 등)는 오늘 발송 대상 아님 — silent skip.
    if (!OPERATOR_TARGET_DAYS.includes(daysOverdue)) continue;

    const amount = amountCol >= 0
      ? toNumber(values[amountCol] ?? text[amountCol]) ?? 0
      : 0;
    const item: ReminderItem = {
      customerName: nameCol >= 0 ? String(text[nameCol] ?? "") : "",
      invoiceDate: String(text[billingDateCol] ?? ""),
      description: detailCol >= 0 ? String(text[detailCol] ?? "") : "",
      daysOverdue,
      amount: amount < 0 ? 0 : amount,
      operatorLabel: operatorName,
    };

    const entry = byOperator.get(operatorEmail);
    if (entry) {
      entry.items.push(item);
    } else {
      byOperator.set(operatorEmail, {
        operator: { name: operatorName, email: operatorEmail },
        items: [item],
      });
    }
  }

  const groups: OperatorReminderGroup[] = Array.from(byOperator.values()).map((g) => ({
    operator: g.operator,
    items: g.items,
    totalAmount: g.items.reduce((sum, it) => sum + it.amount, 0),
  }));

  return { groups, excluded };
}
