import {
  parseBaejungList,
  parsePims,
  parseSimpleSheet,
  BAEJUNG_CURRENT_YEAR,
  BAEJUNG_PREV_YEAR,
} from "./parse";
import type { AssignmentRecord, AssignmentSheet } from "./schemas";

/**
 * 다섯 배정 시트 → 레코드. **어느 칸을 읽을지가 학년도로 갈린다.**
 *
 * 시트는 한 해에 두 학년도를 들고 있다 — 올해 칸과 `前` 칸이다(02 는 학년도가
 * 헤더에 박힌 블록 둘). 순수 함수라 Graph 없이 시험할 수 있고, 파서 설정이
 * **여기 한 곳**에 있어 올해/작년 규칙이 갈릴 자리가 없다.
 *
 * 라이브 실측 헤더(2026-09-22):
 *
 * | 시트 | 올해 | 전년도 |
 * |---|---|---|
 * | 02. 배정리스트 | `2027학년도 운영자/개발자` 블록 | `2026학년도 …` 블록 |
 * | 03. 대학원 | `운영자`(7)·`개발자`(8) | `前 운영자`(9)·`前 개발자`(10) |
 * | 04. PIMS | `운영자 FULL`(6)·`운영자 환/충`(8) | `前 운영자`(9) **한 칸** |
 * | 06. 성적산출 | `운영자`(4)·`개발자`(5) | `前 운영자`(9)·`前 개발자`(10) |
 * | 07. 상담앱 | `운영자`(5)·`개발자`(6) | `前 운영자`(7)·`前 개발자`(8) |
 */

/** 못 읽은 시트는 `null` — 하나가 실패해도 나머지는 읽는다. */
export type AssignmentSheets = {
  배정리스트: AssignmentSheet | null;
  대학원: AssignmentSheet | null;
  PIMS: AssignmentSheet | null;
  성적산출: AssignmentSheet | null;
  상담앱: AssignmentSheet | null;
};

/**
 * 올해 칸은 **`^운영자$` 로 못 박는다.** `/운영자/` 로 두면 `前 운영자` 와
 * `접수운영자` 도 맞아, 어느 칸이 먼저 오는지에 배정이 달린다.
 */
const CURRENT_COLS = { op: /^운영자$/, dev: /^개발자$/ } as const;
/** `前` 은 시트가 쓰는 한자 그대로다. 공백은 있을 때도 없을 때도 있다. */
const PREV_COLS = { op: /前\s*운영자/, dev: /前\s*개발자/ } as const;

const UNI = /대학명/;
/** 07 만 `학교명` 이다 — 초·중·고가 섞여 있다. */
const SCHOOL_OR_UNI = /학교명|대학명/;

/**
 * 그 학년도의 배정 레코드.
 *
 * **시트에 없는 학년도는 빈 배열이다.** 이 가드가 없으면 `2025` 를 물었을 때
 * 올해 칸을 읽어 2025 로 적재한다 — 자연키에 학년도가 있어 충돌도 안 나고,
 * 대조는 양쪽이 같은 시트에서 나오니 그대로 통과한다. 조용히 한 해가 거짓이 된다.
 */
export function recordsFromSheets(
  sheets: AssignmentSheets,
  year: number,
): AssignmentRecord[] {
  if (year !== BAEJUNG_CURRENT_YEAR && year !== BAEJUNG_PREV_YEAR) return [];
  const prev = year === BAEJUNG_PREV_YEAR;
  const cols = prev ? PREV_COLS : CURRENT_COLS;

  const { 배정리스트, 대학원, PIMS, 성적산출, 상담앱 } = sheets;
  return [
    ...(배정리스트 ? parseBaejungList(배정리스트, year) : []),
    ...(대학원
      ? parseSimpleSheet(대학원, "대학원", { uni: UNI, ...cols })
      : []),
    /*
     * PIMS 만 갈래가 둘이다. 올해는 `FULL`·`환충` 이 **독립된 배정**이라
     * 하위유형으로 쪼개야 하고(접힌 대표값을 쓰면 한쪽이 사라진다), 전년도는
     * 칸이 하나라 하위유형이 없다 — `toLedgerRows` 가 레코드 모양을 보고 가른다.
     */
    ...(PIMS
      ? prev
        ? parseSimpleSheet(PIMS, "PIMS", { uni: UNI, op: PREV_COLS.op })
        : parsePims(PIMS)
      : []),
    ...(성적산출
      ? parseSimpleSheet(성적산출, "성적산출", { uni: UNI, ...cols })
      : []),
    ...(상담앱
      ? parseSimpleSheet(상담앱, "상담앱", { uni: SCHOOL_OR_UNI, ...cols })
      : []),
  ];
}
