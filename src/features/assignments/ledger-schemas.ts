import { z } from "zod";
import { SERVICE_KINDS } from "./schemas";

/**
 * 배정 원장의 어휘와 자연키.
 *
 * 원천은 총괄장 엑셀이 아니라 DB 다(설계 §1). 엑셀은 내보내기 산출물이고,
 * 이력·권한·되돌리기는 이 원장 위에서 돈다.
 * 설계: docs/superpowers/specs/2026-09-12-work-assignment-design.md
 */

/** 배정의 두 역할. **정의상 둘뿐**이라 DB 에도 check 가 걸린다. */
export const ASSIGNMENT_ROLES = ["운영", "개발"] as const;
export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

/**
 * 업무종류는 대학배정 탭의 어휘를 **그대로** 쓴다 — 두 번째 목록을 만들지 않는다.
 * DB 에는 check 를 걸지 않는다(시트가 자란다). 어휘를 지키는 것은 이 zod 뿐이다.
 */
export const ASSIGNMENT_WORK_KINDS = SERVICE_KINDS;
export type AssignmentWorkKind = (typeof ASSIGNMENT_WORK_KINDS)[number];

/** 이력 한 줄이 어디서 왔나. 되돌리기도 하나의 출처다(삭제가 아니라 새 행). */
export const ASSIGNMENT_CHANGE_SOURCES = [
  "import",
  "manual",
  "proposal",
  "revert",
] as const;
export type AssignmentChangeSource = (typeof ASSIGNMENT_CHANGE_SOURCES)[number];

/**
 * 자연키. **순서가 곧 unique 인덱스의 컬럼 순서다** —
 * 어긋나면 중복 방지가 엉뚱한 조합에 걸린다. `migration-contract.test.ts` 가 대조한다.
 */
export const ASSIGNMENT_NATURAL_KEY = [
  "academic_year",
  "university_name",
  "work_kind",
  "subtype",
  "role",
] as const;

/** `assignments` 컬럼 — 순서까지 마이그레이션 원문과 같다. */
export const ASSIGNMENT_COLUMNS = [
  "id",
  "academic_year",
  "university_name",
  "work_kind",
  "subtype",
  "role",
  "assignee_email",
  "assignee_name",
  "university_type",
  "note",
  "updated_by",
  "created_at",
  "updated_at",
] as const;

export const assignmentNaturalKeySchema = z.object({
  academic_year: z.number().int().min(2000).max(9999),
  university_name: z.string().trim().min(1),
  work_kind: z.enum(ASSIGNMENT_WORK_KINDS),
  /**
   * 빈 문자열은 통과하고 `null` 과 누락은 거부한다. 앞뒤 공백은 지운다.
   *
   * Postgres 의 unique 는 null 을 서로 다른 값으로 보므로, 이 칸이 null 이면 같은
   * 배정이 몇 번이고 들어간다. 그래서 DB 가 `not null default ''` 이고 여기도 같다.
   * 기본값을 주지 않는 이유는 '하위유형 없음'을 부르는 쪽이 명시하게 하려는 것이다.
   *
   * **`.trim()` 이 없으면 null 만 막고 공백을 열어 둔 것이 된다** — `''` 와 `' '`
   * 도 unique 에는 서로 다른 값이라 자연키가 갈린다. PR3 이 엑셀 셀을 읽어 넣고,
   * 공백은 거기서 온다. 위 `university_name` 이 이미 같은 이유로 다듬는다.
   */
  subtype: z.string().trim(),
  role: z.enum(ASSIGNMENT_ROLES),
});
export type AssignmentNaturalKey = z.infer<typeof assignmentNaturalKeySchema>;
