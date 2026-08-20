"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { getGraphToken } from "@/lib/microsoft/auth";
import { fetchPettyCash, currentSheetName } from "./queries";
import {
  buildSpendRow,
  findDuplicate,
  findInsertRow,
  balanceFormula,
  type SpendInput,
} from "./append";

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
  // 한 줄 적었을 때 덮어쓴다. 값까지 받아야 날짜순 자리를 찾을 수 있다.
  const usedRes = await fetch(`${wsUrl}/usedRange(valuesOnly=true)`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!usedRes.ok) {
    return { ok: false, error: "장부 범위를 읽지 못했습니다" };
  }
  const used = (await usedRes.json()) as { values?: unknown[][] };
  const values = used.values ?? [];
  // 헤더 + 최소 한 줄은 있어야 어디에 넣을지 정할 수 있다. 못 읽었는데 쓰면
  // 1행(헤더)을 덮어쓴다.
  if (values.length < 2) {
    return { ok: false, error: "장부 내용을 읽지 못했습니다" };
  }
  const row = buildSpendRow(input);
  // 날짜순 자리. 뒤늦게 넣는 건이 있어 맨 아래가 아닐 수 있다.
  const target = findInsertRow(values, row[3]);
  const address = `A${target.row}:H${target.row}`;

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  // 중간에 넣을 때는 먼저 한 줄을 밀어낸다. 엑셀이 아래 행들의 수식 참조를
  // 함께 옮겨 주므로, 우리가 손대야 할 건 새로 생긴 빈 줄뿐이다.
  if (target.shiftDown) {
    const ins = await fetch(`${wsUrl}/range(address='${address}')/insert`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ shift: "Down" }),
    });
    if (!ins.ok) {
      console.error("[petty-cash] insert 실패:", ins.status, await ins.text());
      return { ok: false, error: "장부에 줄을 넣지 못했습니다" };
    }
  }

  const patch = await fetch(`${wsUrl}/range(address='${address}')`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ values: [row] }),
  });
  if (!patch.ok) {
    // 조용히 성공이라 하지 않는다 — 장부가 안 맞는데 맞는 줄 알면 더 나쁘다.
    console.error("[petty-cash] PATCH 실패:", patch.status, await patch.text());
    return { ok: false, error: "장부에 쓰지 못했습니다" };
  }

  // 잔액은 수식으로. 값으로 넣으면 그 행부터 자동 계산이 끊긴다.
  const balance = await fetch(`${wsUrl}/range(address='C${target.row}')`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({ formulas: [[balanceFormula(target.row)]] }),
  });
  if (!balance.ok) {
    // 줄은 들어갔는데 잔액만 빈 상태다 — 숨기지 않고 그대로 알린다.
    console.error("[petty-cash] 잔액 수식 실패:", balance.status);
    return {
      ok: false,
      error: "줄은 넣었지만 잔액 수식을 쓰지 못했습니다 — 엑셀에서 확인하세요",
    };
  }

  revalidatePath("/dashboard/postal");
  return { ok: true };
}
