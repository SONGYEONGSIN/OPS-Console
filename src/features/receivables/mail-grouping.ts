import type { ReceivablesSheet } from "./queries";
import type { ExcludedReason, ReminderGroup, ReminderItem } from "./mail-schemas";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 헤더에서 키워드 매칭으로 컬럼 인덱스 반환 (없으면 -1) */
function findCol(headers: string[], regex: RegExp): number {
  return headers.findIndex((h) => regex.test(h));
}

/** 숫자 파싱 — Excel rows / rowsText 양쪽에서 모두 시도 */
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
 * 미수채권 시트에서 학교담당자별로 청구건을 묶는다.
 * - 경과일수 >= thresholdDays 만 포함
 * - 잘못된 이메일은 excluded 로 회수 (silent drop 금지)
 * - 필수 컬럼(학교담당자 / 경과일수) 누락 시 빈 결과 + excluded 사유
 */
export function groupRecipientsByOwner(
  sheet: ReceivablesSheet,
  thresholdDays: number,
): { groups: ReminderGroup[]; excluded: ExcludedReason[] } {
  const excluded: ExcludedReason[] = [];

  const ownerCol = findCol(sheet.headers, /^학교\s*담당자?$|^학교\s*담당\s*이메일$/);
  const overdueCol = findCol(sheet.headers, /경과\s*일수?/);

  if (ownerCol === -1) {
    excluded.push({ rowIndex: -1, reason: "missing_owner_column" });
  }
  if (overdueCol === -1) {
    excluded.push({ rowIndex: -1, reason: "missing_overdue_column" });
  }
  if (ownerCol === -1 || overdueCol === -1) {
    return { groups: [], excluded };
  }

  const nameCol = findCol(sheet.headers, /거래처명?|학교명?/);
  const dateCol = findCol(sheet.headers, /^청구\s*일자/);
  const detailCol = findCol(sheet.headers, /내역|상세/);
  const amountCol = findCol(sheet.headers, /청구\s*금액|금액/);
  const operatorCol = findCol(sheet.headers, /^운영자$/);

  // 학교담당자 컬럼이 owner regex와 겹치므로, 운영자 별도 매칭 실패 시 다른 후보 시도
  const operatorIdx =
    operatorCol !== -1 ? operatorCol : findCol(sheet.headers, /^담당\s*운영자|책임자$/);

  const byEmail = new Map<string, { recipient: { email: string; name?: string }; items: ReminderItem[] }>();

  for (let i = 0; i < sheet.rowsText.length; i++) {
    const text = sheet.rowsText[i] ?? [];
    const values = sheet.rows[i] ?? [];

    const emailRaw = String(text[ownerCol] ?? values[ownerCol] ?? "").trim();
    if (emailRaw === "") {
      excluded.push({ rowIndex: i, reason: "missing_email" });
      continue;
    }
    if (!EMAIL_RE.test(emailRaw)) {
      excluded.push({
        rowIndex: i,
        customerName: nameCol >= 0 ? String(text[nameCol] ?? "") : undefined,
        reason: "invalid_email",
      });
      continue;
    }

    const daysOverdue = toNumber(values[overdueCol] ?? text[overdueCol]);
    if (daysOverdue === null) continue;
    if (daysOverdue < thresholdDays) {
      excluded.push({ rowIndex: i, reason: "below_threshold" });
      continue;
    }

    const amount = toNumber(values[amountCol] ?? text[amountCol]) ?? 0;
    const item: ReminderItem = {
      customerName: nameCol >= 0 ? String(text[nameCol] ?? "") : "",
      invoiceDate: dateCol >= 0 ? String(text[dateCol] ?? "") : "",
      description: detailCol >= 0 ? String(text[detailCol] ?? "") : "",
      daysOverdue,
      amount: amount < 0 ? 0 : amount,
      operatorLabel: operatorIdx >= 0 ? String(text[operatorIdx] ?? "") : "",
    };

    const entry = byEmail.get(emailRaw);
    if (entry) {
      entry.items.push(item);
    } else {
      byEmail.set(emailRaw, {
        recipient: { email: emailRaw },
        items: [item],
      });
    }
  }

  const groups: ReminderGroup[] = Array.from(byEmail.values()).map((g) => ({
    recipient: g.recipient,
    items: g.items,
    totalAmount: g.items.reduce((sum, it) => sum + it.amount, 0),
  }));

  return { groups, excluded };
}
