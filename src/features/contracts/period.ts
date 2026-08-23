/**
 * 계약 종료월 — 대장의 `기간` 칸을 화면에 쓸 수 있는 형태로 바꾼다.
 *
 * 대장의 기간 칸은 사람이 손으로 적는 자유 텍스트다. 4년제는 `~2027년 2월`,
 * 대학원은 `2027.02.28` 처럼 시트마다 어법이 다르고 물결·공백도 섞여 있다.
 * 그래서 문자열을 그대로 쓰지 않고 `YYYY-MM` 으로 맞춘다.
 *
 * 더 중요한 건 **빈 칸이 대다수**라는 것이다(4년제 176곳 중 132곳,
 * 전문대·초중고·기타 시트는 기간 컬럼 자체가 없다). 이 칸은 다년계약 건만
 * 적는 칸이라, 비어 있다는 건 보통 "단년계약이라 학년도와 함께 끝난다"는 뜻이다.
 * 그래서 빈 칸은 학년도 종료월로 채운다.
 *
 * 다만 **다년계약이라고 적혀 있는데 기간이 빈 행이 9곳 있다**(서울대·부산대·
 * 성균관대 등). 거기서는 학년도 종료월이 확실히 틀린 값이므로, 채우되 확인
 * 대상으로 구분해 화면이 스스로 틀렸다고 말하게 한다.
 */

/**
 * 기간이 비어 있을 때 쓰는 종료월 — 계약이 학년도와 함께 끝난다고 본다.
 *
 * 이 값은 지금 읽고 있는 대장이 **2027학년도** 관리대장이라는 데 묶여 있다.
 * `SHAREPOINT_CONTRACTS_ITEM_ID` 를 다음 학년도 대장으로 바꾸면 이 값도 같이
 * 올려야 한다 — 안 그러면 화면이 조용히 한 해 전 날짜를 보여준다.
 */
export const DEFAULT_END_MONTH = "2027-02";

/** 종료월을 어디서 얻었는지 — 화면이 값의 무게를 다르게 보여주기 위한 구분. */
export type ContractEndKind =
  /** 대장에 적힌 값을 읽었다 */
  | "ledger"
  /** 대장이 비어 있어 학년도 종료월로 채웠다 (단년계약) */
  | "assumed"
  /** 대장이 비었는데 다년계약이다 — 채운 값이 틀렸다 */
  | "check"
  /** 적혀 있으나 월을 알 수 없어 원문을 그대로 둔다 */
  | "raw";

export type ContractEnd = {
  label: string;
  kind: ContractEndKind;
};

/** `2027년 7월` 꼴. `2028학년도` 는 4자리 뒤가 `학` 이라 걸리지 않는다. */
const YEAR_MONTH = /(?<!\d)(\d{4})\s*년\s*(\d{1,2})\s*월/;
/** `2027.02.28` · `2027. 8. 31.` 꼴 — 일자는 버리고 월까지만 본다. */
const DOTTED = /(?<!\d)(\d{4})\s*\.\s*(\d{1,2})\s*\./;

function toMonthLabel(year: string, month: string): string | null {
  const m = Number(month);
  // 없는 달을 그대로 통과시키면 오타가 화면에 그대로 뜬다.
  if (!Number.isInteger(m) || m < 1 || m > 12) return null;
  return `${year}-${String(m).padStart(2, "0")}`;
}

/**
 * 대장의 기간 문자열에서 종료월(`YYYY-MM`)을 읽는다. 못 읽으면 null.
 *
 * 월을 알 수 없는 학년도 표기(`~2028학년도 후기`)는 일부러 null 이다 —
 * 후기가 몇 월인지 대장이 말해주지 않으므로 지어내지 않는다.
 */
export function parseEndMonth(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;

  const ym = YEAR_MONTH.exec(text);
  if (ym) return toMonthLabel(ym[1], ym[2]);

  const dotted = DOTTED.exec(text);
  if (dotted) return toMonthLabel(dotted[1], dotted[2]);

  return null;
}

/**
 * 기간 칸과 다년계약 칸을 함께 보고 화면에 쓸 종료월과 그 출처를 정한다.
 *
 * 기간 컬럼이 없는 시트는 `period` 가 undefined 로 들어오며 빈 칸과 같게 다룬다.
 */
export function resolveContractEnd(input: {
  period?: string;
  multiYear?: string;
}): ContractEnd {
  const period = (input.period ?? "").trim();
  const multiYear = (input.multiYear ?? "").trim();

  if (period) {
    const parsed = parseEndMonth(period);
    if (parsed) return { label: parsed, kind: "ledger" };
    return { label: period, kind: "raw" };
  }

  return {
    label: DEFAULT_END_MONTH,
    kind: multiYear ? "check" : "assumed",
  };
}
