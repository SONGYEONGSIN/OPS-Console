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
