import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import type { DepositRow } from "./types";
import { isTransient, RETRY_DELAYS_MS } from "./graph-retry";

/**
 * 마지막 실패 사유. 잡이 이걸 메시지에 실어 **"왜 실패했는지"** 를 남긴다.
 *
 * 2026-08-31 실패 문구가 "파일 이동/이름변경/권한"만 말해서, 실제로는 Graph 가 잠깐
 * 흔들린 것인데 휴지통까지 뒤지게 만들었다. 상태 코드 하나면 바로 갈렸다.
 */
let lastFailure: string | null = null;

export function lastDepositFailure(): string | null {
  return lastFailure;
}

/**
 * Graph 를 부르되 **일시 오류면 두 번 더** 해본다.
 *
 * 실패가 이어지면 사유(상태 코드 + 앞부분)를 남긴다 — 그게 다음 진단의 출발점이다.
 */
async function graphGet(url: string, headers: HeadersInit): Promise<Response | null> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (res.ok) return res;
    const body = (await res.text()).slice(0, 160);
    if (!isTransient(res.status) || attempt >= RETRY_DELAYS_MS.length) {
      lastFailure = `Graph ${res.status}${isTransient(res.status) ? " (재시도 후에도 실패)" : ""} — ${body}`;
      console.error("[deposit] graph fail:", res.status, body);
      return null;
    }
    console.warn(`[deposit] graph ${res.status} — ${RETRY_DELAYS_MS[attempt]}ms 뒤 재시도`);
    await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
  }
}

/**
 * Graph usedRange 응답을 DepositRow[]로 변환. 헤더 키워드 매칭으로 컬럼 인덱스 추출.
 * GAS deposit Excel 컬럼: 거래일시(col 1) / 입금금액(col 3) / 거래내용(col 5) / 미결제표시(col 10).
 * 실제 헤더 순서가 다를 수 있으므로 정규식 매칭으로 동적 인덱싱.
 *
 * SharePoint fetch와 분리 — pure function 으로 단위 테스트 가능.
 */
export function parseDepositSheet(data: {
  values?: unknown[][];
  text?: string[][];
}): DepositRow[] {
  const values = data.values ?? [];
  const textValues = data.text ?? values.map((r) => r.map((c) => String(c ?? "")));
  if (values.length < 2) return [];

  const header = values[0].map((h) => String(h ?? "").trim());
  const findCol = (re: RegExp) => header.findIndex((h) => re.test(h));
  const dateCol = findCol(/거래\s*일시|입금\s*일자|거래일자/);
  // 입금금액 우선 — "금액$"만 쓰면 앞에 있는 "출금금액"에 먼저 매칭되어 0이 잡힘.
  // 입금금액 미존재 시에만 "...금액"으로 폴백하되 출금 컬럼은 제외.
  let amountCol = findCol(/입금\s*금액/);
  if (amountCol < 0) {
    amountCol = header.findIndex((h) => /금액$/.test(h) && !/출금/.test(h));
  }
  const contentCol = findCol(/거래\s*내용|입금자|입금처/);
  const flagCol = findCol(/미결제|처리|결제\s*표시/);

  if (dateCol < 0 || amountCol < 0 || contentCol < 0) {
    console.warn(
      "[deposit-queries] 필수 헤더 매칭 실패",
      { dateCol, amountCol, contentCol },
    );
    return [];
  }

  const out: DepositRow[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i] ?? [];
    const text = textValues[i] ?? [];

    const dateRaw = String(text[dateCol] ?? row[dateCol] ?? "").trim();
    const amountRaw = row[amountCol];
    const amount =
      typeof amountRaw === "number"
        ? amountRaw
        : Number(String(amountRaw ?? "").replace(/,/g, "")) || 0;
    const content = String(text[contentCol] ?? row[contentCol] ?? "").trim();
    const matchedFlag =
      flagCol >= 0
        ? String(text[flagCol] ?? row[flagCol] ?? "").trim()
        : "";

    if (!dateRaw && !content && amount === 0) continue;

    out.push({
      row: i + 1, // Excel 1-based row number (헤더 1행 + 데이터 i)
      date: dateRaw,
      amount,
      content,
      matchedFlag,
    });
  }
  return out;
}

/**
 * 입금 시트 fetch 실패 시 잡 메시지 — env 미설정과 "설정됐으나 fetch 실패"를 구분.
 * 후자는 파일 이동/이름변경/권한/Graph 응답 문제이므로 Vercel 로그를 봐야 한다.
 */
export function depositFetchFailMessage(
  itemIdConfigured: boolean,
  reason = lastDepositFailure(),
): string {
  if (!itemIdConfigured) {
    return "SharePoint 입금내역 시트 fetch 실패 — SHAREPOINT_DEPOSIT_ITEM_ID 환경변수 미설정.";
  }
  // **사유를 앞에 둔다.** 그게 없으면 잠깐 흔들린 것도 "파일이 사라졌나" 로 읽힌다.
  return reason
    ? `SharePoint 입금내역 시트 fetch 실패 — ${reason}`
    : "SharePoint 입금내역 시트 fetch 실패 — 사유 불명. Vercel 로그를 확인하세요.";
}

/**
 * SharePoint deposit Excel usedRange fetch + parseDepositSheet.
 * - drive_id 재사용: `SHAREPOINT_RECEIVABLES_DRIVE_ID`
 * - item_id 신규: `SHAREPOINT_DEPOSIT_ITEM_ID` (필수)
 * - GAS DEPOSIT_SHEET_NAME = "수수료입금내역조회" — 첫 워크시트 자동 선택
 * 실패/없음 → null.
 */
export async function fetchDepositSheet(): Promise<DepositRow[] | null> {
  const driveId = process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID;
  const itemId = process.env.SHAREPOINT_DEPOSIT_ITEM_ID;
  if (!driveId || !itemId) {
    console.warn(
      "[deposit] SHAREPOINT_RECEIVABLES_DRIVE_ID / SHAREPOINT_DEPOSIT_ITEM_ID 환경 변수 누락",
    );
    return null;
  }

  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    console.error("[deposit] graph token error:", e);
    return null;
  }

  const base = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook`;
  const headers = { Authorization: `Bearer ${token}` };

  // 첫 워크시트 이름
  lastFailure = null;
  const wsRes = await graphGet(`${base}/worksheets?$top=1&$select=name`, headers);
  if (!wsRes) return null;
  const wsJson = (await wsRes.json()) as { value?: { name: string }[] };
  const name = wsJson.value?.[0]?.name;
  if (!name) return [];

  const enc = encodeURIComponent(name);
  // **`valuesOnly` 로 받는다.** `values,text` 는 401KB·4.5초였고 Graph 가
  // `MaxRequestDurationExceeded` 로 끊었다(2026-09-02). 이쪽은 186KB·3.0초다.
  //
  // `text` 를 빼도 되는 이유: 실측해 보니 거래일시가 이미 `2025-12-01 11:58:00`
  // 문자열로 온다 — 같은 값을 한 번 더 싣고 있었다. `parseDepositSheet` 는
  // `text` 가 없으면 `values` 로 물러서므로 그대로 읽힌다.
  const rangeRes = await graphGet(
    `${base}/worksheets('${enc}')/usedRange(valuesOnly=true)?$select=values`,
    headers,
  );
  if (!rangeRes) return null;
  const data = (await rangeRes.json()) as {
    values?: unknown[][];
    text?: string[][];
  };
  return parseDepositSheet(data);
}
