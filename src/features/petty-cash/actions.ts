"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { getGraphToken } from "@/lib/microsoft/auth";
import { fetchPettyCash, currentSheetName } from "./queries";
import { buildSpendRow, findDuplicate, nextRowAddress, type SpendInput } from "./append";

/**
 * 전도금 장부에 사용 한 줄을 붙인다.
 *
 * **엑셀 쓰기는 되돌리기 어렵다.** 화면에서 지울 방법이 없고, Graph 워크북은 반영에
 * 1~2분 걸려 직후 재조회로 성공 판정도 못 한다(기록: graph-workbook-session-persist-delay).
 * 그래서 쓰기 **전에** 막을 것을 다 막는다 — 권한·잔액·중복.
 */

export type AppendResult = { ok: true } | { ok: false; error: string };

export async function appendSpend(input: SpendInput): Promise<AppendResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };
  // 장부를 고치는 일이라 읽기 전용에게는 안 연다.
  if (me.permission === "viewer") {
    return { ok: false, error: "읽기 전용 권한입니다" };
  }
  if (!(input.amount > 0)) {
    return { ok: false, error: "금액이 0 이하입니다" };
  }

  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const itemId = process.env.SHAREPOINT_PETTY_CASH_ITEM_ID;
  if (!driveId || !itemId) {
    return { ok: false, error: "전도금 장부 설정이 없습니다" };
  }

  // 잔액을 모르면 계산이 틀린다 — 못 읽으면 아예 쓰지 않는다.
  const sheet = await fetchPettyCash();
  if (!sheet) return { ok: false, error: "전도금 장부를 읽지 못했습니다" };
  if (sheet.balance == null) {
    return { ok: false, error: "현재 잔액을 읽지 못했습니다" };
  }

  // 같은 건이 이미 있으면 쓰지 않는다 — 두 번 확정해도 장부는 한 줄이어야 한다.
  if (findDuplicate(sheet.entries, input)) {
    return { ok: false, error: "같은 날짜·금액·건수가 이미 장부에 있습니다" };
  }

  let token: string;
  try {
    token = await getGraphToken();
  } catch {
    return { ok: false, error: "Graph 인증에 실패했습니다" };
  }

  const sheetName = currentSheetName();
  const base = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook`;
  const wsUrl = `${base}/worksheets('${encodeURIComponent(sheetName)}')`;

  // 어디에 쓸지는 지금 시트가 정한다 — 우리가 센 행 수를 믿으면 사람이 그새
  // 한 줄 적었을 때 덮어쓴다.
  const usedRes = await fetch(`${wsUrl}/usedRange(valuesOnly=true)?$select=rowCount`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!usedRes.ok) {
    return { ok: false, error: "장부 범위를 읽지 못했습니다" };
  }
  const used = (await usedRes.json()) as { rowCount?: number };
  const address = nextRowAddress(used.rowCount ?? 1);

  const row = buildSpendRow(input, sheet.balance);
  const patch = await fetch(`${wsUrl}/range(address='${address}')`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ values: [row] }),
  });
  if (!patch.ok) {
    // 조용히 성공이라 하지 않는다 — 장부가 안 맞는데 맞는 줄 알면 더 나쁘다.
    console.error("[petty-cash] PATCH 실패:", patch.status, await patch.text());
    return { ok: false, error: "장부에 쓰지 못했습니다" };
  }

  revalidatePath("/dashboard/postal");
  return { ok: true };
}
