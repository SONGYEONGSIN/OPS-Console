import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ledgerYears } from "./ledger-filter";
import {
  expectedSheetName,
  parseLedgerRows,
  type LedgerRow,
} from "./ledger-parse";

/**
 * 등기관리대장 읽기 — 화면의 주인공.
 *
 * 파일은 `2026년도 우편물 발송.xlsx`(`SHAREPOINT_MAIL_ITEM_ID`)이고, 공문 시행번호가
 * 쓰는 파일과 같은 드라이브에 있다.
 *
 * 영수증은 **증빙**이라 대장 행에 붙여 보여준다. 잇는 열쇠는 등기번호다 —
 * 한 영수증에 등기가 여러 건 찍히므로 여러 행이 같은 영수증을 가리킨다.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

export type LedgerLine = LedgerRow & {
  /** 증빙 영수증. 없으면 null — 시스템 도입 전 수기 행이 그렇다. */
  receiptId: string | null;
};

export type Ledger = {
  sheetName: string;
  rows: LedgerLine[];
  /** 대장이 있는 모든 연도 — 시트가 곧 연도라 여기서 뽑는다. */
  years: number[];
};

export async function readLedger(year: number): Promise<Ledger> {
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const itemId = process.env.SHAREPOINT_MAIL_ITEM_ID;
  if (!driveId || !itemId) {
    throw new Error("SHAREPOINT_DRIVE_ID / SHAREPOINT_MAIL_ITEM_ID 미설정");
  }

  const token = await getGraphToken();
  const headers = { Authorization: `Bearer ${token}` };
  const base = `${GRAPH}/drives/${driveId}/items/${itemId}/workbook`;

  // 시트 이름에 연도가 박혀 있다. 첫 시트를 무턱대고 읽으면 내년 4월에 새 시트가
  // 생기는 순간 조용히 작년 대장을 보여주게 된다.
  const wsRes = await fetch(`${base}/worksheets`, { headers });
  const ws = (await wsRes.json()) as { value?: { name: string }[] };
  const want = expectedSheetName(year);
  const found = (ws.value ?? []).find((w) => w.name === want);
  if (!found) {
    throw new Error(
      `대장에 "${want}" 시트가 없습니다 — 새 연도 시트를 만들었는지 확인하세요`,
    );
  }

  const rangeRes = await fetch(
    `${base}/worksheets('${encodeURIComponent(want)}')/usedRange(valuesOnly=true)`,
    { headers },
  );
  const range = (await rangeRes.json()) as { values?: unknown[][] };
  const rows = parseLedgerRows(range.values ?? []);

  const byTracking = await receiptByTracking();
  return {
    sheetName: want,
    years: ledgerYears((ws.value ?? []).map((w) => w.name)),
    rows: rows.map((r) => ({
      ...r,
      receiptId: r.trackingNo ? (byTracking.get(r.trackingNo) ?? null) : null,
    })),
  };
}

/** 등기번호 → 영수증 id. 확정된 건만 `postal_items`에 있다. */
async function receiptByTracking(): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("postal_items")
    .select("tracking_no, receipt_id");
  const map = new Map<string, string>();
  for (const row of (data ?? []) as {
    tracking_no: string;
    receipt_id: string;
  }[]) {
    map.set(row.tracking_no, row.receipt_id);
  }
  return map;
}
