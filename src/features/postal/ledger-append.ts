import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import { expectedSheetName } from "./ledger-parse";
import { isoToExcelSerial } from "@/lib/excel-date";
import {
  buildLedgerRows,
  findLedgerInsertRow,
  nextDaySeq,
  type LedgerWriteRow,
} from "./ledger-write";

/**
 * 확정한 등기를 대장 엑셀에 붙인다 — 3단계.
 *
 * 지금까지는 확정해도 `postal_items`(DB)와 전도금 장부에만 들어가고, **등기대장은
 * 손으로** 적었다.
 *
 * **쓰기 전에 막을 것을 다 막는다.** Graph 워크북은 반영에 1~2분 걸려 직후 재조회로
 * 성공 판정도 못 하고, 잘못 쓰면 화면에서 지울 방법이 없다.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

export type LedgerAppendResult =
  { ok: true; row: number } | { ok: false; error: string };

export async function appendToLedger(
  rows: LedgerWriteRow[],
  meta: { sentOn: string; confirmedBy: string },
): Promise<LedgerAppendResult> {
  if (rows.length === 0) return { ok: false, error: "쓸 등기 건이 없습니다" };

  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const itemId = process.env.SHAREPOINT_MAIL_ITEM_ID;
  if (!driveId || !itemId) {
    return { ok: false, error: "등기대장 설정이 없습니다" };
  }

  let token: string;
  try {
    token = await getGraphToken();
  } catch {
    return { ok: false, error: "Graph 인증에 실패했습니다" };
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
  const base = `${GRAPH}/drives/${driveId}/items/${itemId}/workbook`;

  // 그 해 시트가 있어야 한다. 시트 이름에 연도가 박혀 있어, 없는데도 첫 시트에
  // 쓰면 작년 대장을 건드리게 된다 — 그건 되돌리기 어렵다.
  const year = Number(meta.sentOn.slice(0, 4));
  const want = expectedSheetName(year);
  const wsRes = await fetch(`${base}/worksheets`, { headers });
  const ws = (await wsRes.json()) as { value?: { name: string }[] };
  if (!(ws.value ?? []).some((w) => w.name === want)) {
    return { ok: false, error: `대장에 "${want}" 시트가 없습니다` };
  }
  const wsUrl = `${base}/worksheets('${encodeURIComponent(want)}')`;

  // 어디에 쓸지는 지금 시트가 정한다 — 우리가 센 행 수를 믿으면 사람이 그새
  // 한 줄 적었을 때 덮어쓴다.
  const usedRes = await fetch(`${wsUrl}/usedRange(valuesOnly=true)`, {
    headers,
    cache: "no-store",
  });
  if (!usedRes.ok) return { ok: false, error: "대장 범위를 읽지 못했습니다" };
  const used = (await usedRes.json()) as { values?: unknown[][] };
  const values = used.values ?? [];
  // 헤더 + 최소 한 줄은 있어야 자리를 정할 수 있다. 못 읽었는데 쓰면 1행을 덮는다.
  if (values.length < 2) {
    return { ok: false, error: "대장 내용을 읽지 못했습니다" };
  }

  // 같은 등기번호가 이미 있으면 쓰지 않는다 — 두 번 확정해도 대장은 한 줄이어야 한다.
  const existing = new Set(
    values.slice(1).map((r) => String(r?.[6] ?? "").trim()),
  );
  const dup = rows.find((r) => existing.has(r.trackingNo.trim()));
  if (dup) {
    return {
      ok: false,
      error: `이미 대장에 있는 등기번호입니다: ${dup.trackingNo}`,
    };
  }

  const dateSerial = isoToExcelSerial(meta.sentOn);
  const target = findLedgerInsertRow(values, dateSerial);
  const body = buildLedgerRows(rows, {
    dateSerial,
    startSeq: nextDaySeq(values, dateSerial),
    confirmedBy: meta.confirmedBy,
  });
  const address = `A${target.row}:H${target.row + rows.length - 1}`;

  // 중간에 넣을 때는 먼저 줄을 밀어낸다. 엑셀이 아래 행들의 참조를 함께 옮겨 준다.
  if (target.shiftDown) {
    const ins = await fetch(`${wsUrl}/range(address='${address}')/insert`, {
      method: "POST",
      headers,
      body: JSON.stringify({ shift: "Down" }),
    });
    if (!ins.ok) {
      console.error("[postal] 대장 insert 실패:", ins.status, await ins.text());
      return { ok: false, error: "대장에 줄을 넣지 못했습니다" };
    }
  }

  const patch = await fetch(`${wsUrl}/range(address='${address}')`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ values: body }),
  });
  if (!patch.ok) {
    // 조용히 성공이라 하지 않는다 — 대장이 안 맞는데 맞는 줄 알면 더 나쁘다.
    console.error(
      "[postal] 대장 PATCH 실패:",
      patch.status,
      await patch.text(),
    );
    return { ok: false, error: "대장에 쓰지 못했습니다" };
  }

  return { ok: true, row: target.row };
}
