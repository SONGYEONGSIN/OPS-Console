import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import { getWorkbookSession } from "@/lib/microsoft/workbook-session";
import { createWorkbookCaller, rangeUrl } from "./patch";

/** written=false 는 열이 이미 같은 목록이라 쓰지 않았다는 뜻. */
export type WriteUnpaidResult =
  | { ok: true; written: boolean }
  | { ok: false; errorMessage: string };

/** 이전 목록이 더 길었어도 남지 않도록 넉넉히 지운다. U열은 간격, M~T 는 검색 결과라 V 만 쓴다. */
const CLEAR_RANGE = "V1:V3000";

async function failure(label: string, res: Response): Promise<WriteUnpaidResult> {
  const text = await res.text();
  return {
    ok: false,
    errorMessage: `Graph ${label} ${res.status}: ${text.slice(0, 200)}`,
  };
}

function nonEmptyCells(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((row) => (Array.isArray(row) ? row[0] : undefined))
    .filter((v) => v !== undefined && v !== null && v !== "")
    .map((v) => String(v));
}

/**
 * 입금내역관리대장 V열에 미수 학교 목록을 쓴다 — V1=머리글, V2~=학교 한 줄씩.
 *
 * 현재 V열을 먼저 읽어 같은 목록이면 쓰지 않는다 — 매시간 다시 쓰면 목록이 그대로여도
 * 버전 기록이 쌓이고 같이 편집 중인 사람 화면에 갱신이 밀려 들어간다.
 * 다르면 contents clear → values PATCH 순서라 서식·수식·다른 열은 건드리지 않는다.
 * Graph 는 실패를 던지지 않고 응답으로 주므로 status 를 보고, 던지는 경우(세션·토큰)는 잡아서
 * ok:false 로 돌려준다 — 매칭 결과를 막지 않고 호출 쪽이 errors 에 싣는다.
 */
export async function writeUnpaidSchools(
  schools: readonly string[],
  depositSheetName: string,
): Promise<WriteUnpaidResult> {
  const driveId = process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID;
  const itemId = process.env.SHAREPOINT_DEPOSIT_ITEM_ID;
  if (!driveId || !itemId) {
    return {
      ok: false,
      errorMessage:
        "SHAREPOINT_RECEIVABLES_DRIVE_ID / SHAREPOINT_DEPOSIT_ITEM_ID 누락",
    };
  }

  try {
    const call = createWorkbookCaller(
      driveId,
      itemId,
      await getWorkbookSession(driveId, itemId),
      await getGraphToken(),
    );
    const writeRange = `V1:V${schools.length + 1}`;
    const values = [[`미수 학교 (${schools.length}곳)`], ...schools.map((s) => [s])];

    const readRes = await call(rangeUrl(driveId, itemId, depositSheetName, CLEAR_RANGE), {
      method: "GET",
    });
    if (!readRes.ok) return await failure(`GET ${CLEAR_RANGE}`, readRes);
    const current = nonEmptyCells(((await readRes.json()) as { values?: unknown }).values);
    const next = values.map((row) => row[0]);
    if (current.length === next.length && current.every((v, i) => v === next[i])) {
      return { ok: true, written: false };
    }

    const clearRes = await call(
      `${rangeUrl(driveId, itemId, depositSheetName, CLEAR_RANGE)}/clear`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ applyTo: "Contents" }),
      },
    );
    if (!clearRes.ok) return await failure(`clear ${CLEAR_RANGE}`, clearRes);

    const writeRes = await call(
      rangeUrl(driveId, itemId, depositSheetName, writeRange),
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values }),
      },
    );
    if (!writeRes.ok) return await failure(`PATCH ${writeRange}`, writeRes);
    return { ok: true, written: true };
  } catch (e) {
    return {
      ok: false,
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}
