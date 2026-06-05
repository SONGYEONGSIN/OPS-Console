"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { getGraphToken } from "@/lib/microsoft/auth";
import { getWorkbookSession } from "@/lib/microsoft/workbook-session";
import { logActivity } from "@/features/worklog/log";
import {
  contractUpdateSchema,
  type ContractSheet,
} from "./schemas";
import { listContracts } from "./queries";
import { matchContractsByName, type ContractMatch } from "./match";

const DRIVE_ID = process.env.SHAREPOINT_DRIVE_ID;
const ITEM_ID = process.env.SHAREPOINT_CONTRACTS_ITEM_ID;

const SHEET_NAME_MAP: Record<ContractSheet, string> = {
  "4년제": "4년제",
  "전문대": "전문대",
  "초중고": "초중고",
  "대학원": "대학원",
  "기타": "기타(전문학교,모의논술,공공 등)",
};

export type UpdateResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

/**
 * Contracts Excel 단일 셀 PATCH — Microsoft Graph range write.
 *
 * - admin/member 권한 필요 (viewer 차단)
 * - workbook session 사용 → 다음 fetch가 즉시 새 값 반환
 * - 발신자/시각 로그는 SharePoint 측 자동 (operator 활동 기록 별도)
 */
export async function updateContractField(
  input: unknown,
): Promise<UpdateResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다." };
  if (me.permission !== "admin" && me.permission !== "member") {
    return { ok: false, error: "수정 권한이 없습니다." };
  }
  if (!DRIVE_ID || !ITEM_ID) {
    return { ok: false, error: "SHAREPOINT_DRIVE_ID / SHAREPOINT_CONTRACTS_ITEM_ID 미설정" };
  }

  const parsed = contractUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const { sheet, cellAddress, value } = parsed.data;
  const actualSheet = SHEET_NAME_MAP[sheet];

  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  let sessionId: string | null = null;
  try {
    sessionId = await getWorkbookSession(DRIVE_ID, ITEM_ID);
  } catch {
    sessionId = null;
  }

  const url = `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/items/${ITEM_ID}/workbook/worksheets('${encodeURIComponent(actualSheet)}')/range(address='${encodeURIComponent(cellAddress)}')`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (sessionId) headers["workbook-session-id"] = sessionId;

  const res = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ values: [[value]] }),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error(
      `[contracts.update] ${res.status} sheet=${sheet} cell=${cellAddress}: ${txt.slice(0, 200)}`,
    );
    return { ok: false, error: `graph_${res.status}` };
  }

  await logActivity({
    domain: "contracts",
    action: "update_cell",
    target_type: "contracts_sheet",
    target_id: `${sheet}-${cellAddress}`,
    target_name: `${sheet} ${cellAddress}`,
    msg: `계약 셀 수정 → "${value}"`,
    metadata: { sheet, cell: cellAddress, value },
  });

  revalidatePath("/dashboard/contracts");
  return { ok: true, value };
}

export type ContractSearchResult =
  | { ok: true; matches: ContractMatch[] }
  | { ok: false; error: string };

/**
 * 계약정보 자동 채움용 — 학교명으로 계약 행을 검색한다.
 * Microsoft Graph 워크북 호출이라 비용이 크므로 인스펙터에서 명시적 검색 시에만 호출.
 */
export async function searchContractsByUniversity(
  name: string,
): Promise<ContractSearchResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "인증이 필요합니다." };
  const term = name.trim();
  if (!term) return { ok: true, matches: [] };
  try {
    const { rows } = await listContracts();
    return { ok: true, matches: matchContractsByName(rows, term) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "검색 실패" };
  }
}
