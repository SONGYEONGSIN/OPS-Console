import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import { getWorkbookSession } from "@/lib/microsoft/workbook-session";
import { createWorkbookCaller, rangeUrl } from "./patch";

/** written=false 는 열이 이미 같은 목록이라 쓰지 않았다는 뜻. */
export type WriteUnpaidResult =
  | { ok: true; written: boolean }
  | { ok: false; errorMessage: string };

type Call = (url: string, init?: RequestInit) => Promise<Response>;
type Failure = Extract<WriteUnpaidResult, { ok: false }>;

/** 제목 행. 학교명은 그 아래부터. V1~V3 은 비워 둔다. */
const TITLE_ROW = 4;
const BODY_END_ROW = 3000;
const BODY_RANGE = `V${TITLE_ROW + 1}:V${BODY_END_ROW}`;

const JSON_HEADERS = { "content-type": "application/json" };

/** 이전 목록이 더 길었어도 남지 않도록 넉넉히 지운다. U열은 간격, M~T 는 검색 결과라 V 만 쓴다. */
const CLEAR_RANGE = "V1:V3000";

async function failure(label: string, res: Response): Promise<Failure> {
  const text = await res.text();
  return {
    ok: false,
    errorMessage: `Graph ${label} ${res.status}: ${text.slice(0, 200)}`,
  };
}

/** V1 부터의 칸을 위치 그대로 문자열로 — 뒤쪽 빈 칸만 잘라 낸다. */
function columnCells(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const cells = values.map((row) => {
    const v = Array.isArray(row) ? row[0] : undefined;
    return v === undefined || v === null ? "" : String(v);
  });
  while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
  return cells;
}

/** 현재 열이 (위치까지) 쓰려는 목록과 같은가 — V1~V3 이 비고 V4 부터 제목·이름. */
function isSameLayout(values: unknown, next: readonly string[]): boolean {
  const expected = [...Array<string>(TITLE_ROW - 1).fill(""), ...next];
  const current = columnCells(values);
  return current.length === expected.length && current.every((v, i) => v === expected[i]);
}

function pickDefined(
  data: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  return Object.fromEntries(
    keys.filter((k) => data[k] !== undefined && data[k] !== null).map((k) => [k, data[k]]),
  );
}

/** from 의 속성을 읽어 to 에 그대로 PATCH. null(혼합/없음) 속성은 뺀다. 실패하면 사유. */
async function copyProps(
  call: Call,
  from: string,
  to: string,
  keys: readonly string[],
  label: string,
): Promise<Failure | null> {
  const getRes = await call(from, { method: "GET" });
  if (!getRes.ok) return await failure(`${label} GET`, getRes);
  const props = pickDefined((await getRes.json()) as Record<string, unknown>, keys);
  const patchRes = await call(to, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(props),
  });
  return patchRes.ok ? null : await failure(`${label} PATCH`, patchRes);
}

/** M4 채우기를 V4 로. 색이 없거나 흰색이면 V4 채우기를 지운다. */
async function copyFill(call: Call, m4: string, v4: string): Promise<Failure | null> {
  const getRes = await call(`${m4}/format/fill`, { method: "GET" });
  if (!getRes.ok) return await failure("format V4 fill GET", getRes);
  const { color } = (await getRes.json()) as { color?: string | null };
  const blank = !color || color.toUpperCase() === "#FFFFFF";
  const res = blank
    ? await call(`${v4}/format/fill/clear`, { method: "POST" })
    : await call(`${v4}/format/fill`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ color }),
      });
  return res.ok ? null : await failure("format V4 fill", res);
}

const FONT_KEYS = ["name", "size", "bold", "color", "italic"] as const;
const ALIGN_KEYS = ["horizontalAlignment", "verticalAlignment"] as const;

/** 사용자의 검색 표(M4 머리글·M5 본문) 서식을 V열에 입힌다. M~T 는 읽기만 한다. */
async function copyFormat(
  call: Call,
  driveId: string,
  itemId: string,
  sheet: string,
): Promise<Failure | null> {
  const at = (range: string) => rangeUrl(driveId, itemId, sheet, range);
  const v4 = at(`V${TITLE_ROW}`);
  const m4 = at(`M${TITLE_ROW}`);
  return (
    (await copyFill(call, m4, v4)) ??
    (await copyProps(call, `${m4}/format/font`, `${v4}/format/font`, FONT_KEYS, "format V4 font")) ??
    (await copyProps(call, `${m4}/format`, `${v4}/format`, ALIGN_KEYS, "format V4 align")) ??
    (await copyProps(
      call,
      `${at(`M${TITLE_ROW + 1}`)}/format/font`,
      `${at(BODY_RANGE)}/format/font`,
      FONT_KEYS,
      `format ${BODY_RANGE}`,
    ))
  );
}

/**
 * 입금내역관리대장 V열에 미수 학교 목록을 쓴다 — V4=제목, V5~=학교 한 줄씩(V1~V3 은 비움).
 *
 * 현재 V열을 먼저 읽어 같은 목록이면 쓰지 않는다 — 매시간 다시 쓰면 목록이 그대로여도
 * 버전 기록이 쌓이고 같이 편집 중인 사람 화면에 갱신이 밀려 들어간다.
 * 다르면 contents clear → values PATCH → 서식 복사 순서다. 서식은 검색 표(M4/M5)에서 읽어
 * V열에만 입히고 M~T 와 다른 열은 쓰지 않는다. 서식 단계가 실패해도 값은 이미 썼으니 되돌리지 않는다.
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
    const writeRange = `V${TITLE_ROW}:V${TITLE_ROW + schools.length}`;
    const values = [[`미수 학교 (${schools.length}곳)`], ...schools.map((s) => [s])];

    const readRes = await call(rangeUrl(driveId, itemId, depositSheetName, CLEAR_RANGE), {
      method: "GET",
    });
    if (!readRes.ok) return await failure(`GET ${CLEAR_RANGE}`, readRes);
    const current = ((await readRes.json()) as { values?: unknown }).values;
    if (isSameLayout(current, values.map((row) => row[0]))) {
      return { ok: true, written: false };
    }

    const clearRes = await call(
      `${rangeUrl(driveId, itemId, depositSheetName, CLEAR_RANGE)}/clear`,
      {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ applyTo: "Contents" }),
      },
    );
    if (!clearRes.ok) return await failure(`clear ${CLEAR_RANGE}`, clearRes);

    const writeRes = await call(
      rangeUrl(driveId, itemId, depositSheetName, writeRange),
      {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ values }),
      },
    );
    if (!writeRes.ok) return await failure(`PATCH ${writeRange}`, writeRes);
    return (await copyFormat(call, driveId, itemId, depositSheetName)) ?? { ok: true, written: true };
  } catch (e) {
    return {
      ok: false,
      errorMessage: e instanceof Error ? e.message : String(e),
    };
  }
}
