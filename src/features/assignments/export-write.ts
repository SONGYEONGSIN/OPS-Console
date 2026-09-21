import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import {
  getWorkbookSession,
  refreshWorkbookSession,
} from "@/lib/microsoft/workbook-session";
import { listLedgerRows } from "./ledger-queries";
import {
  BAEJUNG_CURRENT_YEAR,
} from "./parse";
import {
  EXPORT_SHEET_NAME,
  buildExportGrid,
} from "./export-rows";

/**
 * 확정 원장 → 총괄장의 `(앱) 배정확정` 시트.
 *
 * 설계: docs/superpowers/specs/2026-09-12-work-assignment-design.md §7
 *
 * **조립은 `export-rows.ts`(순수 함수)가 한다.** 여기는 Graph 만 다룬다 — 시험이
 * 조립 쪽에 다 들어가고, 이 얇은 층은 호출 순서와 실패 처리만 본다.
 */

/** 세션 재발급으로 풀릴 수 있는 것만. 403·404 는 다시 불러도 그대로다. */
const RETRY_STATUSES = new Set([408, 503, 504]);

/**
 * 지우는 구간의 아래끝. 시트가 이보다 길어질 일은 없다(원장이 2천 행인데 대학은
 * 500 남짓이고 한 대학이 한 행이다). 열도 학년도 2벌 + 4종이면 40칸을 안 넘는다.
 */
const CLEAR_LAST_ROW = 5000;
const CLEAR_LAST_COL = "BZ";

export type ExportResult = {
  ok: boolean;
  dryRun: boolean;
  rows: number;
  columns: number;
  error?: string;
};

function sheetUrl(driveId: string, itemId: string, suffix: string): string {
  return (
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}` +
    `/workbook/worksheets('${encodeURIComponent(EXPORT_SHEET_NAME)}')${suffix}`
  );
}

function headers(token: string, sessionId: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "workbook-session-id": sessionId,
  };
}

/** A..Z, AA.. — 열 주소. 40칸 남짓이라 두 자리면 충분하지만 일반형으로 둔다. */
function columnAddress(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * 시트가 없으면 만든다. **목록을 먼저 본다** — `add` 를 무조건 부르면 이미 있을 때
 * 409 가 오고, 그걸 무시하면 진짜 실패도 같이 삼킨다.
 */
async function ensureSheet(
  driveId: string,
  itemId: string,
  token: string,
  sessionId: string,
): Promise<string | null> {
  const listUrl = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook/worksheets`;
  const res = await fetch(listUrl, { headers: headers(token, sessionId) });
  if (!res.ok) {
    return `Graph 시트 목록 ${res.status}: ${(await res.text()).slice(0, 200)}`;
  }
  const body = (await res.json()) as { value?: { name?: string }[] };
  if ((body.value ?? []).some((s) => s.name === EXPORT_SHEET_NAME)) return null;

  const add = await fetch(`${listUrl}/add`, {
    method: "POST",
    headers: headers(token, sessionId),
    body: JSON.stringify({ name: EXPORT_SHEET_NAME }),
  });
  if (!add.ok) {
    return `Graph 시트 생성 ${add.status}: ${(await add.text()).slice(0, 200)}`;
  }
  return null;
}

/**
 * **이 시트는 통째로 다시 쓴다** — 한 range 에 2차원 배열 한 번. 행별 PATCH 는
 * 중간에 죽으면 위쪽만 새 값이고 아래는 지난 값인 시트를 남긴다(§7.3).
 */
export async function exportAssignmentsToSheet(): Promise<ExportResult> {
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const itemId = process.env.SHAREPOINT_ASSIGNMENTS_ITEM_ID;
  const dryRun = process.env.ASSIGNMENT_EXPORT_DRY_RUN === "true";

  if (!driveId || !itemId) {
    const missing = !driveId
      ? "SHAREPOINT_DRIVE_ID"
      : "SHAREPOINT_ASSIGNMENTS_ITEM_ID";
    return { ok: false, dryRun, rows: 0, columns: 0, error: `${missing} 미설정` };
  }

  const ledger = await listLedgerRows(BAEJUNG_CURRENT_YEAR);
  const grid = buildExportGrid(ledger);

  /**
   * **원장이 비면 쓰지 않는다.** 조립은 머리글 3줄을 늘 돌려주므로 빈 원장도 형태는
   * 멀쩡하다 — 그대로 쓰면 시트가 머리글만 남고 지난 배정이 통째로 사라진다.
   * 조회가 실패해 0건으로 읽힌 경우와 구분할 방법이 없으니 쓰지 않는 쪽이 맞다.
   */
  if (ledger.length === 0) {
    return {
      ok: false,
      dryRun,
      rows: grid.length,
      columns: grid[0]?.length ?? 0,
      error: "원장이 비어 있습니다 — 시트를 통째로 비우지 않습니다",
    };
  }

  const rows = grid.length;
  const columns = grid[0]?.length ?? 0;

  /** dry run 은 **조립까지** 한다 — 열이 몇 칸인지 보려고 켜는 것이다. */
  if (dryRun) return { ok: true, dryRun, rows, columns };

  let token: string;
  let sessionId: string;
  try {
    token = await getGraphToken();
    sessionId = await getWorkbookSession(driveId, itemId);
  } catch (e) {
    return {
      ok: false,
      dryRun,
      rows,
      columns,
      error: `Graph 토큰·세션 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const sheetError = await ensureSheet(driveId, itemId, token, sessionId);
  if (sheetError) return { ok: false, dryRun, rows, columns, error: sheetError };

  const address = `A1:${columnAddress(columns - 1)}${rows}`;
  const patchUrl = sheetUrl(driveId, itemId, `/range(address='${address}')`);

  const patchOnce = (sid: string) =>
    fetch(patchUrl, {
      method: "PATCH",
      headers: headers(token, sid),
      body: JSON.stringify({ values: grid }),
    });

  let res = await patchOnce(sessionId);
  if (!res.ok && RETRY_STATUSES.has(res.status)) {
    try {
      sessionId = await refreshWorkbookSession(driveId, itemId);
    } catch (e) {
      return {
        ok: false,
        dryRun,
        rows,
        columns,
        error: `세션 재발급 실패: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    res = await patchOnce(sessionId);
  }
  if (!res.ok) {
    return {
      ok: false,
      dryRun,
      rows,
      columns,
      error: `Graph PATCH ${address} ${res.status}: ${(await res.text()).slice(0, 200)}`,
    };
  }

  /**
   * **쓴 뒤에 아래를 지운다.** 지난 내보내기가 더 길었으면 그 꼬리가 남아, 없어진
   * 대학이 계속 배정된 것처럼 보인다. 순서를 뒤집으면 지우고 나서 PATCH 가 실패했을
   * 때 시트가 통째로 빈다 — 쓰기가 성공한 뒤에만 지운다.
   */
  const clearAddress = `A${rows + 1}:${CLEAR_LAST_COL}${CLEAR_LAST_ROW}`;
  const clearRes = await fetch(
    sheetUrl(driveId, itemId, `/range(address='${clearAddress}')/clear`),
    {
      method: "POST",
      headers: headers(token, sessionId),
      body: JSON.stringify({ applyTo: "contents" }),
    },
  );
  if (!clearRes.ok) {
    return {
      ok: false,
      dryRun,
      rows,
      columns,
      error: `Graph clear ${clearAddress} ${clearRes.status}: ${(await clearRes.text()).slice(0, 200)}`,
    };
  }

  /**
   * **여기서 재조회해 확인하지 않는다.** 워크북 PATCH 는 파일 반영에 1~2 분 걸려,
   * 직후에 읽으면 지난 값이 온다 — 성공을 실패로 읽는다(2026-08-14 실제 사고).
   */
  return { ok: true, dryRun, rows, columns };
}
