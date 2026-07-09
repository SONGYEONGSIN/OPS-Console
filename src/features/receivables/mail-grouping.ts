import type { ReceivablesSheet } from "./queries";
import type {
  ExcludedReason,
  OperatorReminderGroup,
  ReminderGroup,
  ReminderItem,
} from "./mail-schemas";
import { computeElapsedDays } from "./overdue";
import { OPERATORS } from "@/features/auth/operators";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 운영자명 → 메일박스 이메일. 시트의 '운영자' 셀은 이름이라 역방향 lookup이 필요하다. */
const OPERATOR_NAME_TO_EMAIL: ReadonlyMap<string, string> = new Map(
  OPERATORS.map((o) => [o.name, o.email]),
);

/** 헤더에서 키워드 매칭으로 컬럼 인덱스 반환 (없으면 -1) */
function findCol(headers: string[], regex: RegExp): number {
  return headers.findIndex((h) => regex.test(h));
}

/** '메일발송일자' 컬럼의 헤더 인덱스 (없으면 -1). 발송 후 발송일자 기록용. */
export function findMailSentDateCol(headers: string[]): number {
  return findCol(headers, /^메일\s*발송\s*일자$/);
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
 * - 경과일수 = 청구일자 기준 오늘까지 일수(인스펙터 elapsedDays와 동일 계산).
 *   `경과일수 >= thresholdDays` 만 포함
 * - 잘못된 이메일은 excluded 로 회수 (silent drop 금지)
 * - 필수 컬럼(학교담당자 / 청구일자) 누락 시 빈 결과 + excluded 사유
 *
 * @param now 경과일수 계산 기준 시각 (테스트 결정성을 위해 주입, 기본 현재)
 */
export function groupRecipientsByOwner(
  sheet: ReceivablesSheet,
  thresholdDays: number,
  now: Date = new Date(),
): { groups: ReminderGroup[]; excluded: ExcludedReason[] } {
  const excluded: ExcludedReason[] = [];

  const ownerCol = findCol(
    sheet.headers,
    /^학교\s*담당자?$|^학교\s*담당\s*이메일$/,
  );
  // 경과일수 전용 컬럼은 시트에 없음 — 청구일자로 계산한다(인스펙터와 동일).
  const billingDateCol = findCol(sheet.headers, /^청구\s*일자/);

  if (ownerCol === -1) {
    excluded.push({ rowIndex: -1, reason: "missing_owner_column" });
  }
  if (billingDateCol === -1) {
    excluded.push({ rowIndex: -1, reason: "missing_billing_date_column" });
  }
  if (ownerCol === -1 || billingDateCol === -1) {
    return { groups: [], excluded };
  }

  const nameCol = findCol(sheet.headers, /거래처명?|학교명?/);
  const detailCol = findCol(sheet.headers, /내역|상세/);
  const amountCol = findCol(sheet.headers, /청구\s*금액|금액/);
  const operatorCol = findCol(sheet.headers, /^운영자$/);

  // 학교담당자 컬럼이 owner regex와 겹치므로, 운영자 별도 매칭 실패 시 다른 후보 시도
  const operatorIdx =
    operatorCol !== -1
      ? operatorCol
      : findCol(sheet.headers, /^담당\s*운영자|책임자$/);

  const byEmail = new Map<
    string,
    { recipient: { email: string; name?: string }; items: ReminderItem[] }
  >();

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

    // 경과일수 = 청구일자 기준 오늘까지 일수 (인스펙터 표시값과 동일)
    const billingText = String(
      text[billingDateCol] ?? values[billingDateCol] ?? "",
    );
    const daysOverdue = computeElapsedDays(billingText, now);
    if (daysOverdue === null) continue;
    if (daysOverdue < thresholdDays) {
      excluded.push({ rowIndex: i, reason: "below_threshold" });
      continue;
    }
    // 학교담당자 메일은 admin 수동 트리거 — 마일스톤 미적용(경과 >= threshold면 발송 가능).
    // (자동 잡인 운영자 메일만 마일스톤 적용. 향후 학교 메일 자동화 시 SCHOOL_TARGET_DAYS 사용.)

    const amount = toNumber(values[amountCol] ?? text[amountCol]) ?? 0;
    const item: ReminderItem = {
      customerName: nameCol >= 0 ? String(text[nameCol] ?? "") : "",
      invoiceDate: String(text[billingDateCol] ?? ""),
      description: detailCol >= 0 ? String(text[detailCol] ?? "") : "",
      daysOverdue,
      amount: amount < 0 ? 0 : amount,
      operatorLabel: operatorIdx >= 0 ? String(text[operatorIdx] ?? "") : "",
      // Excel 1-based 행 번호 (헤더 다음이 첫 데이터 행) — 발송일자 기록 PATCH 대상
      excelRow: sheet.headerRowNumber + 1 + i,
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

/**
 * 수동 발송용 — 미수채권 시트를 (담당 운영자, 학교담당자) 단위로 묶는다.
 *
 * `groupRecipientsByOwner`와 필터 규칙(`경과 >= thresholdDays`, 마일스톤 미적용)은 같지만,
 * 발신 메일박스를 담당 운영자 본인으로 쓰기 위해 운영자 차원을 추가로 쪼갠다.
 * 자동화 잡의 `groupSchoolByOperator`는 마일스톤 정확 일치 + 적요 제외 규칙이라 별도 함수.
 *
 * 운영자명 → 이메일 매핑에 실패한 행은 `blocked`로 회수하고 발송하지 않는다(admin 폴백 금지).
 * 매핑에 성공한 다른 운영자 그룹은 정상 발송 대상으로 남는다(그룹 단위 격리).
 *
 * @param now 경과일수 계산 기준 시각 (테스트 결정성을 위해 주입)
 */
export function groupOwnerByOperator(
  sheet: ReceivablesSheet,
  thresholdDays: number,
  now: Date = new Date(),
): { groups: OperatorReminderGroup[]; blocked: ExcludedReason[] } {
  const blocked: ExcludedReason[] = [];

  const ownerCol = findCol(
    sheet.headers,
    /^학교\s*담당자?$|^학교\s*담당\s*이메일$/,
  );
  const billingDateCol = findCol(sheet.headers, /^청구\s*일자/);
  const opExact = findCol(sheet.headers, /^운영자$/);
  const operatorCol =
    opExact !== -1 ? opExact : findCol(sheet.headers, /^담당\s*운영자|책임자$/);

  if (ownerCol === -1)
    blocked.push({ rowIndex: -1, reason: "missing_owner_column" });
  if (billingDateCol === -1)
    blocked.push({ rowIndex: -1, reason: "missing_billing_date_column" });
  if (operatorCol === -1)
    blocked.push({ rowIndex: -1, reason: "missing_operator_column" });
  if (ownerCol === -1 || billingDateCol === -1 || operatorCol === -1) {
    return { groups: [], blocked };
  }

  const nameCol = findCol(sheet.headers, /거래처명?|학교명?/);
  const detailCol = findCol(sheet.headers, /내역|상세/);
  const amountCol = findCol(sheet.headers, /청구\s*금액|금액/);

  const byKey = new Map<string, OperatorReminderGroup>();

  for (let i = 0; i < sheet.rowsText.length; i++) {
    const text = sheet.rowsText[i] ?? [];
    const values = sheet.rows[i] ?? [];
    const customerName = nameCol >= 0 ? String(text[nameCol] ?? "") : "";

    // 1) 임계값 — 아직 도래하지 않은 행은 '제외 사유'가 아니라 그냥 대상 밖이므로 조용히 skip
    const billingText = String(
      text[billingDateCol] ?? values[billingDateCol] ?? "",
    );
    const daysOverdue = computeElapsedDays(billingText, now);
    if (daysOverdue === null || daysOverdue < thresholdDays) continue;

    // 2) 학교담당자 이메일 — 미기입도 대상 밖(아직 담당자 미등록). 형식 오류만 blocked.
    const ownerEmail = String(text[ownerCol] ?? values[ownerCol] ?? "").trim();
    if (ownerEmail === "") continue;
    if (!EMAIL_RE.test(ownerEmail)) {
      blocked.push({ rowIndex: i, customerName, reason: "invalid_email" });
      continue;
    }

    // 3) 발신 운영자 — 매핑 실패는 발송 차단 사유로 UI에 노출
    const operatorName = String(
      text[operatorCol] ?? values[operatorCol] ?? "",
    ).trim();
    if (operatorName === "") {
      blocked.push({
        rowIndex: i,
        customerName,
        recipientEmail: ownerEmail,
        reason: "operator_not_found",
      });
      continue;
    }
    const operatorEmail = OPERATOR_NAME_TO_EMAIL.get(operatorName);
    if (!operatorEmail) {
      blocked.push({
        rowIndex: i,
        customerName,
        recipientEmail: ownerEmail,
        reason: "operator_email_not_mapped",
      });
      continue;
    }

    const amount = toNumber(values[amountCol] ?? text[amountCol]) ?? 0;
    const item: ReminderItem = {
      customerName,
      invoiceDate: String(text[billingDateCol] ?? ""),
      description: detailCol >= 0 ? String(text[detailCol] ?? "") : "",
      daysOverdue,
      amount: amount < 0 ? 0 : amount,
      operatorLabel: operatorName,
      excelRow: sheet.headerRowNumber + 1 + i,
    };

    const key = `${operatorEmail} ${ownerEmail.toLowerCase()}`;
    const entry = byKey.get(key);
    if (entry) {
      entry.items.push(item);
    } else {
      byKey.set(key, {
        sender: { name: operatorName, email: operatorEmail },
        recipient: { email: ownerEmail },
        items: [item],
        totalAmount: 0,
      });
    }
  }

  const groups = Array.from(byKey.values()).map((g) => ({
    ...g,
    totalAmount: g.items.reduce((sum, it) => sum + it.amount, 0),
  }));

  return { groups, blocked };
}
