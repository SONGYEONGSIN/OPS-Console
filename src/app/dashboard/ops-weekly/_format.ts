import { kstFormat } from "@/lib/kst-format";

// ko-KR 기본 표기(`11. 19.`)를 그대로 쓰지 않고 부품으로 조립한다.
const MD_HM = kstFormat({
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const HM = kstFormat({ hour: "2-digit", minute: "2-digit" });
const MD_DOW = kstFormat({
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

function partsOf(fmt: Intl.DateTimeFormat, d: Date): Record<string, string> {
  return Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
}

/** `M/D HH:mm` — KST 24시간제. */
export function formatMdHm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = partsOf(MD_HM, d);
  // 일부 ICU 는 자정을 `24` 로 준다.
  const hour = p.hour === "24" ? "00" : p.hour;
  return `${p.month}/${p.day} ${hour}:${p.minute}`;
}

/** `M/D(요일)` — `YYYY-MM-DD` 를 KST 날짜로 읽는다. */
export function formatMdDow(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return "—";
  const p = partsOf(MD_DOW, d);
  return `${p.month}/${p.day}(${p.weekday})`;
}

/** `HH:mm` — KST 24시간제. 저장 시각 표시용. */
export function formatHm(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = partsOf(HM, d);
  return `${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}

const YMD = kstFormat({ year: "numeric", month: "2-digit", day: "2-digit" });

/** `YYYY.MM.DD` — KST 날짜. 값이 없거나 깨졌으면 `—`. */
export function formatYmd(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = partsOf(YMD, d);
  return `${p.year}.${p.month}.${p.day}`;
}

/**
 * 접수기간 `시작 ~ 종료`. 종료 연도는 시작과 같은 해일 때만 생략한다 —
 * 종료가 1년 뒤로 잘못 적힌 건이 `09.07 ~ 09.11` 처럼 멀쩡해 보이면 안 된다.
 */
export function formatPeriod(start: string | null, end: string): string {
  const e = formatYmd(end);
  if (!start) return `~ ${e}`;
  const s = formatYmd(start);
  const sameYear = s !== "—" && e !== "—" && s.slice(0, 4) === e.slice(0, 4);
  return `${s} ~ ${sameYear ? e.slice(5) : e}`;
}
