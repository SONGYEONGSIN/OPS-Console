/**
 * 고객센터 운영시간 안내.
 *
 * 평소에는 **요일별 기본 시간**이고, **수시(9월)·정시(1월) 두 철만** 연장한다.
 *
 * 그동안 `평일 09:00~18:00 (마감일 ~22:00 연장 운영)` 한 줄로 나갔는데 실제와 달랐다
 * — 월요일은 10시에 열고 금요일은 17시에 닫는다. 대학 담당자가 그 시간을 보고
 * 지원자에게 안내하므로, 틀린 시간이 그대로 퍼진다(2026-09-01 실제 안내문으로 정정).
 */

/** 고객센터 번호. 여기 한 곳에만 둔다. */
export const CALL_CENTER = "1544-7715";

/** 평소 운영시간 — 요일마다 다르다. */
const BASE_LINES = [
  `· 지원자 문의 : 진학어플라이 고객센터 ${CALL_CENTER}`,
  "   └ 월 10~18시 / 화~목 09~18시 / 금 09~17시 (주말·공휴일 휴무)",
  "   └ 점심시간 12:20~13:30 (수요일은 ~14시)",
];

/**
 * 연장 운영 기간 — **연 2회(수시 9월·정시 1월)뿐이다.**
 *
 * 여기 없는 기간은 기본 시간으로 나간다. 없는 시간을 알리는 것보다 낫다.
 * 새 철이 오면 이 표에 한 줄 더한다.
 */
const EXTENDED: { from: string; to: string; label: string; lines: string[] }[] = [
  {
    from: "2026-09-07",
    to: "2026-09-11",
    label: "2026 수시(4년제)",
    lines: [
      "   └ 09/07(월)~09/09(수) 09~18시, 09/10(목)~09/11(금) 09~21시 연장 운영",
    ],
  },
  {
    from: "2026-09-30",
    to: "2026-09-30",
    label: "2026 수시(전문대 마감)",
    lines: ["   └ 09/30(수) 09~21시 연장 운영"],
  },
];

/** `2026-09-08T10:00:00+09:00` → `2026-09-08` (KST 기준 날짜). */
function kstYmd(iso: string): string | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  // 한국 날짜로 잘라야 한다 — UTC 로 자르면 자정 근처가 하루씩 밀린다.
  return new Date(ms + 9 * 60 * 60_000).toISOString().slice(0, 10);
}

/**
 * 접수 시작일로 안내 문구를 고른다. 그 무렵이 지원자가 문의를 시작하는 때다.
 *
 * 연장 기간이어도 **기본 시간을 함께** 적는다 — 연장이 끝난 뒤에도 문의는 온다.
 */
export function callCenterLines(
  writeStartAt: string | null | undefined,
): string[] {
  const ymd = writeStartAt ? kstYmd(writeStartAt) : null;
  if (!ymd) return BASE_LINES;

  const hit = EXTENDED.find((p) => ymd >= p.from && ymd <= p.to);
  return hit ? [...BASE_LINES, ...hit.lines] : BASE_LINES;
}
