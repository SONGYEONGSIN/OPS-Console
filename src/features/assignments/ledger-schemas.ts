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

/**
 * 하위유형 표시 순서 — **설계 §3.1 이 적은 시트 열 순서**다.
 *
 * DB 조회 순서는 보장이 없어서 정해 두지 않으면 화면 줄 순서가 실행마다 바뀐다.
 * 가나다순으로 두면 `재외/수시/정시` 가 뒤집혀 오늘 화면과 달라진다. 여기 없는
 * 하위유형(시트가 자라면 생긴다)은 뒤에 가나다순으로 붙는다.
 */
export const ASSIGNMENT_SUBTYPE_ORDER = [
  "재외",
  "수시",
  "정시",
  "편입",
  "외국인",
  "백업",
  "백업자",
  "FULL",
  "환충",
] as const;

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

/**
 * 이력 한 줄 — 자연키 + 바뀐 것 + 누가·언제.
 *
 * **`ledger-queries.ts` 가 아니라 여기 둔다.** 그쪽은 `server-only` 라 인스펙터가
 * 타입조차 가져갈 수 없는데, 이력을 그리는 것은 화면이다(`LedgerRow` 를 `import.ts`
 * 에 둔 것과 같은 이유).
 *
 * `prev_assignee`/`next_assignee` 는 **이메일**이다. 이름 스냅샷은 원장에만 있어서,
 * 화면이 사람 이름으로 보여주려면 `operators` 를 곁들여 풀어야 한다 — 그 사람이
 * 지워졌으면 이름을 못 찾는데, 그건 이력이 이메일 단위라는 사실의 결과다.
 */
export type AssignmentChange = AssignmentNaturalKey & {
  id: string;
  prev_assignee: string | null;
  next_assignee: string | null;
  source: AssignmentChangeSource;
  actor_email: string | null;
  /** ISO 문자열. 화면에서 `kstFormat` 으로 찍는다. */
  changed_at: string;
};

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

/**
 * 편집이 보내는 한 칸. 학년도·대학명은 묶음 쪽에 한 번만 있다 — 한 대학의 칸 여러
 * 개를 한 번에 저장하므로 칸마다 되풀이하면 어긋날 자리가 생긴다.
 *
 * `assignee_email` 이 `null` 인 것은 **비우기**다(운영 칸) 또는 **개발 칸**이다.
 * 둘을 가르는 것은 `role` 이고, 개발 칸은 이메일이 원래 없다 — `operators` 가
 * 운영부 표라 개발자가 들어갈 자리가 없다.
 */
export const assignmentCellInputSchema = z.object({
  work_kind: z.enum(ASSIGNMENT_WORK_KINDS),
  subtype: z.string().trim(),
  role: z.enum(ASSIGNMENT_ROLES),
  assignee_email: z.string().trim().email().nullable(),
  assignee_name: z.string().trim(),
});
export type AssignmentCellInput = z.infer<typeof assignmentCellInputSchema>;

/**
 * 편집 입력. **칸이 하나도 없으면 거부한다** — 배선 실수로 빈 배열이 오면
 * '아무것도 안 바뀜' 과 구분이 안 되고, 그게 성공으로 보이면 아무도 못 알아챈다.
 */
export const assignmentUpdateSchema = z.object({
  academic_year: z.number().int().min(2000).max(9999),
  university_name: z.string().trim().min(1),
  cells: z.array(assignmentCellInputSchema).min(1, "바꿀 칸이 없습니다"),
});
export type AssignmentUpdateInput = z.infer<typeof assignmentUpdateSchema>;

/** 되돌릴 이력 한 줄의 id. 모양이 아니면 조회조차 하지 않는다. */
export const assignmentChangeIdSchema = z.string().uuid();
