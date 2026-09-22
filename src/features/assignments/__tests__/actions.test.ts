import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getCurrentOperator: vi.fn(),
  fetchSheet: vi.fn(),
  listLedgerRows: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
  // 편집·되돌리기가 쓰는 admin 클라이언트 — 표마다 창구가 다르다.
  adminFrom: vi.fn(),
  ledgerSelect: vi.fn(),
  operatorsSelect: vi.fn(),
  upsert: vi.fn(),
  insert: vi.fn(),
  changeSelect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: h.createAdminClient,
}));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: h.getCurrentOperator,
}));
vi.mock("../ledger-queries", () => ({ listLedgerRows: h.listLedgerRows }));
// SHEET_NAMES 는 **진짜를 쓴다** — 목으로 흉내 내면 시트 이름이 바뀌어도 초록이다.
vi.mock("../queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../queries")>()),
  fetchAssignmentSheet: h.fetchSheet,
}));

import {
  reconcileAssignments,
  updateAssignment,
  revertChange,
  importAssignments,
  type ReconcileAssignmentsResult,
  type UpdateAssignmentResult,
  type ImportAssignmentsResult,
} from "../actions";
import { BAEJUNG_CURRENT_YEAR, BAEJUNG_PREV_YEAR } from "../parse";
import { SHEET_NAMES } from "../queries";

/**
 * 대조 action 은 **읽고 견주기만** 한다 — 파싱은 `parse.ts`, 행 변환은 `import.ts`,
 * 견주기는 `reconcile` 이 각자 시험받았다. 여기서 보는 것은 그 사이의 배선이다:
 * 권한 · 시트 다섯 · 원장 읽기 · 결과 전달, 그리고 **아무것도 쓰지 않는다**.
 *
 * 파서는 목으로 바꾸지 않는다. 시트 이름과 파서가 어긋나는 배선 실수는 파서를
 * 가리면 안 보인다.
 */
const ADMIN = { email: "admin@x.com", name: "관리자", permission: "admin" };

/** 04. PIMS — 최소 시트. FULL 만 채우면 1행이 된다. */
const PIMS_SHEET = {
  worksheetName: SHEET_NAMES.PIMS,
  rowsText: [
    ["대학명", "운영자 FULL", "운영자 환/충"],
    ["서울대학교", "가운영", ""],
  ],
  rowCount: 2,
  columnCount: 3,
};

/** 03. 대학원 — 하위유형 없는 업무. 운영·개발 두 행이 된다. */
const GRAD_SHEET = {
  worksheetName: SHEET_NAMES.대학원,
  rowsText: [
    ["대학명", "운영자", "개발자"],
    ["고려대학교", "나운영", "나개발"],
  ],
  rowCount: 2,
  columnCount: 3,
};

/** PIMS 한 칸이 원장에 들어가 있는 모양. */
function ledgerCell(name: string, email: string | null = "a@x.com") {
  return {
    academic_year: 2027,
    university_name: "서울대학교",
    work_kind: "PIMS" as const,
    subtype: "FULL",
    role: "운영" as const,
    assignee_email: email,
    assignee_name: name,
  };
}

function ok(r: ReconcileAssignmentsResult) {
  if (!r.ok) throw new Error(`실패로 돌아왔다: ${r.error}`);
  return r;
}

describe("reconcileAssignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getCurrentOperator.mockResolvedValue(ADMIN);
    h.fetchSheet.mockImplementation(async (name: string) =>
      name === SHEET_NAMES.PIMS ? PIMS_SHEET : null,
    );
    h.listLedgerRows.mockResolvedValue([ledgerCell("가운영")]);
  });

  /**
   * **이 세 건이 쓰기 철거의 증거다**(설계 §14 PR4).
   *
   * 원장에는 쓰기 정책이 아예 없고 `service_role` 에만 `grant all` 이 있다. 즉
   * **admin 클라이언트를 안 쓰는 것이 곧 쓸 수 없다는 증거**다 — 세션 클라이언트로는
   * 문법이 맞아도 0행이 바뀐다. 이관 버튼이 남아 있으면 클릭 한 번이 앱 편집 전부를
   * 시트 값으로 되돌리고, 대조는 그걸 못 잡는다(쓰기 뒤에 견주니 0건으로 통과한다).
   */
  describe("읽기 전용", () => {
    it("admin 클라이언트를 만들지 않는다", async () => {
      await reconcileAssignments(2027);
      expect(h.createAdminClient).not.toHaveBeenCalled();
    });

    it("화면을 다시 그리지 않는다 — 바뀐 것이 없다", async () => {
      await reconcileAssignments(2027);
      expect(h.revalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("권한·입력", () => {
    it("admin 이 아니면 시트도 읽지 않는다", async () => {
      h.getCurrentOperator.mockResolvedValue({
        ...ADMIN,
        permission: "member",
      });

      const r = await reconcileAssignments(2027);

      expect(r.ok).toBe(false);
      expect(h.fetchSheet).not.toHaveBeenCalled();
    });

    it("비로그인이면 아무것도 하지 않는다", async () => {
      h.getCurrentOperator.mockResolvedValue(null);
      const r = await reconcileAssignments(2027);
      expect(r.ok).toBe(false);
      expect(h.fetchSheet).not.toHaveBeenCalled();
    });

    it("학년도가 범위를 벗어나면 조회하지 않는다", async () => {
      // 학년도가 자연키에 있어, 이상한 값은 아무도 안 보는 섬과 대조된다.
      const r = await reconcileAssignments(1999);
      expect(r.ok).toBe(false);
      expect(h.listLedgerRows).not.toHaveBeenCalled();
    });
  });

  describe("시트 읽기", () => {
    it("다섯 시트를 모두 읽는다", async () => {
      await reconcileAssignments(2027);
      const asked = h.fetchSheet.mock.calls.map((c) => c[0]);
      expect(asked).toEqual(
        expect.arrayContaining([
          SHEET_NAMES.배정리스트,
          SHEET_NAMES.대학원,
          SHEET_NAMES.PIMS,
          SHEET_NAMES.성적산출,
          SHEET_NAMES.상담앱,
        ]),
      );
    });

    it("시트를 하나도 못 읽으면 실패로 돌려준다", async () => {
      // 0건 성공으로 끝내면 '시트와 원장이 같다' 로 읽힌다.
      h.fetchSheet.mockResolvedValue(null);
      const r = await reconcileAssignments(2027);
      expect(r.ok).toBe(false);
    });

    it("시트마다 맞는 파서로 간다 — PIMS 와 대학원이 각자 work_kind 로 센다", async () => {
      h.fetchSheet.mockImplementation(async (name: string) => {
        if (name === SHEET_NAMES.PIMS) return PIMS_SHEET;
        if (name === SHEET_NAMES.대학원) return GRAD_SHEET;
        return null;
      });
      h.listLedgerRows.mockResolvedValue([]);

      const r = ok(await reconcileAssignments(2027));

      // PIMS 운영 1 + 대학원 운영·개발 2 = 3칸
      expect(r.reconcile.cells.sheet).toBe(3);
    });
  });

  describe("대조", () => {
    it("원장을 학년도로 읽어 견준다", async () => {
      const r = ok(await reconcileAssignments(2027));

      expect(h.listLedgerRows).toHaveBeenCalledWith(2027);
      expect(r.reconcile.mismatchCount).toBe(0);
      expect(r.reconcile.cells).toEqual({ sheet: 1, ledger: 1 });
    });

    it("원장에 없는 칸을 드러낸다", async () => {
      h.listLedgerRows.mockResolvedValue([]);

      const r = ok(await reconcileAssignments(2027));

      expect(r.reconcile.mismatchCount).toBe(1);
      expect(r.reconcile.missingInLedger[0]).toContain("서울대학교");
    });

    it("같은 칸에 이름이 갈리면 어느 쪽이 무엇인지 알려준다", async () => {
      // 갈림을 만들지 않으면서 갈림을 탐지하는 것이 이 버튼의 존재 이유다(§13 R1).
      h.listLedgerRows.mockResolvedValue([ledgerCell("딴사람")]);

      const r = ok(await reconcileAssignments(2027));

      expect(r.reconcile.nameMismatch).toEqual([
        {
          key: "2027|서울대학교|PIMS|FULL|운영",
          sheet: "가운영",
          ledger: "딴사람",
        },
      ]);
    });

    it("원장 조회가 실패하면 실패로 돌려준다 — 조용한 0건은 거짓말이다", async () => {
      // 삼키면 시트 전량을 '원장에 없음' 으로 세고, 사람은 멀쩡한 원장을 의심한다.
      h.listLedgerRows.mockRejectedValue(new Error("원장 조회 실패: boom"));

      const r = await reconcileAssignments(2027);

      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("원장 조회 실패");
    });

    it("같은 칸에 이름이 둘이면 이슈로 돌려준다", async () => {
      // 조용히 접으면 배정 하나가 말없이 없어진다.
      h.fetchSheet.mockImplementation(async (name: string) =>
        name === SHEET_NAMES.PIMS
          ? {
              ...PIMS_SHEET,
              rowsText: [
                ["대학명", "운영자 FULL", "운영자 환/충"],
                ["서울대학교", "가운영", ""],
                ["서울대학교", "다른사람", ""],
              ],
            }
          : null,
      );

      const r = ok(await reconcileAssignments(2027));

      expect(r.issues).toHaveLength(1);
      expect(r.issues[0].kind).toBe("duplicate-conflict");
      expect(r.issues[0].university).toBe("서울대학교");
    });
  });
});
// ─────────────────────────────────────────────────────────────
// 편집 — `updateAssignment`
// ─────────────────────────────────────────────────────────────

const ledgerEqYear = vi.fn();
const ledgerEqUniv = vi.fn();
const operatorsIn = vi.fn();

/** 원장에 들어 있는 한 칸(admin 재조회가 돌려주는 모양). */
function currentCell(overrides: Record<string, unknown> = {}) {
  return {
    work_kind: "PIMS",
    subtype: "FULL",
    role: "운영",
    assignee_email: "a@x.com",
    assignee_name: "가운영",
    ...overrides,
  };
}

const input = (cells: unknown[]) => ({
  academic_year: 2027,
  university_name: "서울대학교",
  cells,
});

function okUpdate(r: UpdateAssignmentResult) {
  if (!r.ok) throw new Error(`실패로 돌아왔다: ${r.error}`);
  return r;
}

/**
 * 편집은 **원장에 쓴다** — 그래서 admin 클라이언트다(쓰기 정책이 없다).
 *
 * 핵심은 **서버가 폼을 믿지 않는다**는 것이다. 폼은 이 칸의 현재 담당자를 함께
 * 보내지만, 그 화면이 열린 뒤에 다른 사람이 같은 칸을 고쳤을 수 있다. 폼이 보낸
 * 이전값으로 이력을 남기면 **실제로 일어난 적 없는 변경**이 이력에 박히고,
 * 되돌리기가 그 거짓을 되돌린다. 그래서 이전값은 DB 에서 다시 읽는다.
 */
describe("updateAssignment", () => {
  /** 한 칸의 담당자를 a@x.com → b@x.com 으로 바꾸는 입력. */
  const SWAP = {
    work_kind: "PIMS",
    subtype: "FULL",
    role: "운영",
    assignee_email: "b@x.com",
    assignee_name: "나운영",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    h.getCurrentOperator.mockResolvedValue(ADMIN);
    h.createAdminClient.mockReturnValue({ from: h.adminFrom });
    h.adminFrom.mockImplementation((table: string) => {
      if (table === "assignments")
        return { select: h.ledgerSelect, upsert: h.upsert };
      if (table === "operators") return { select: h.operatorsSelect };
      if (table === "assignment_changes") return { insert: h.insert };
      throw new Error(`예상치 못한 테이블: ${table}`);
    });
    h.ledgerSelect.mockReturnValue({ eq: ledgerEqYear });
    ledgerEqYear.mockReturnValue({ eq: ledgerEqUniv });
    ledgerEqUniv.mockResolvedValue({ data: [currentCell()], error: null });
    h.operatorsSelect.mockReturnValue({ in: operatorsIn });
    operatorsIn.mockResolvedValue({
      data: [{ email: "b@x.com", name: "나운영" }],
      error: null,
    });
    h.upsert.mockResolvedValue({ error: null });
    h.insert.mockResolvedValue({ error: null });
  });

  describe("권한·입력", () => {
    it("admin 이 아니면 admin 클라이언트조차 만들지 않는다", async () => {
      h.getCurrentOperator.mockResolvedValue({
        ...ADMIN,
        permission: "member",
      });

      const r = await updateAssignment(input([SWAP]));

      expect(r.ok).toBe(false);
      expect(h.createAdminClient).not.toHaveBeenCalled();
    });

    it("비로그인이면 아무것도 하지 않는다", async () => {
      h.getCurrentOperator.mockResolvedValue(null);
      const r = await updateAssignment(input([SWAP]));
      expect(r.ok).toBe(false);
      expect(h.upsert).not.toHaveBeenCalled();
    });

    it("학년도가 범위를 벗어나면 거부한다", async () => {
      const r = await updateAssignment({
        ...input([SWAP]),
        academic_year: 1999,
      });
      expect(r.ok).toBe(false);
      expect(h.upsert).not.toHaveBeenCalled();
    });

    it("업무종류가 어휘 밖이면 거부한다 — 아무도 안 보는 섬이 생긴다", async () => {
      const r = await updateAssignment(
        input([{ ...SWAP, work_kind: "없는업무" }]),
      );
      expect(r.ok).toBe(false);
      expect(h.upsert).not.toHaveBeenCalled();
    });

    it("칸이 하나도 없으면 거부한다 — 배선 실수가 성공으로 보이면 안 된다", async () => {
      const r = await updateAssignment(input([]));
      expect(r.ok).toBe(false);
      expect(h.upsert).not.toHaveBeenCalled();
    });
  });

  describe("폼을 믿지 않는다", () => {
    it("이전값을 DB 에서 다시 읽는다", async () => {
      await updateAssignment(input([SWAP]));

      expect(h.adminFrom).toHaveBeenCalledWith("assignments");
      expect(ledgerEqYear).toHaveBeenCalledWith("academic_year", 2027);
      expect(ledgerEqUniv).toHaveBeenCalledWith(
        "university_name",
        "서울대학교",
      );
    });

    it("값이 같으면 아무것도 쓰지 않는다 — 저장을 두 번 눌러도 이력이 안 늘어난다", async () => {
      const r = okUpdate(
        await updateAssignment(
          input([
            {
              work_kind: "PIMS",
              subtype: "FULL",
              role: "운영",
              assignee_email: "a@x.com",
              assignee_name: "가운영",
            },
          ]),
        ),
      );

      expect(r.changed).toBe(0);
      expect(h.upsert).not.toHaveBeenCalled();
      expect(h.insert).not.toHaveBeenCalled();
    });

    it("원장에 없는 칸은 거부한다 — 이 화면은 담당자 교체만 한다", async () => {
      const r = await updateAssignment(input([{ ...SWAP, subtype: "환충" }]));
      expect(r.ok).toBe(false);
      expect(h.upsert).not.toHaveBeenCalled();
    });

    it("운영 칸의 이름 스냅샷은 명부에서 온다 — 폼이 보낸 이름을 쓰지 않는다", async () => {
      // 폼이 낡은 이름을 들고 있을 수 있다(개명·오타). 원장의 이름은 그 이메일의
      // 현재 이름이어야 한다 — 아니면 화면이 한 사람을 두 이름으로 부른다.
      await updateAssignment(input([{ ...SWAP, assignee_name: "엉뚱한이름" }]));

      const [row] = h.upsert.mock.calls[0][0] as { assignee_name: string }[];
      expect(row.assignee_name).toBe("나운영");
    });
  });

  describe("운영 칸", () => {
    it("담당자를 바꾸면 자연키로 쓰고 이력 한 줄을 남긴다", async () => {
      const r = okUpdate(await updateAssignment(input([SWAP])));

      expect(r.changed).toBe(1);
      expect(r.history).toBe(1);
      expect(h.upsert.mock.calls[0][1]).toMatchObject({
        onConflict: "academic_year,university_name,work_kind,subtype,role",
      });
      expect(h.upsert.mock.calls[0][0]).toEqual([
        {
          academic_year: 2027,
          university_name: "서울대학교",
          work_kind: "PIMS",
          subtype: "FULL",
          role: "운영",
          assignee_email: "b@x.com",
          assignee_name: "나운영",
          updated_by: "admin@x.com",
        },
      ]);
      expect(h.insert.mock.calls[0][0]).toEqual([
        {
          academic_year: 2027,
          university_name: "서울대학교",
          work_kind: "PIMS",
          subtype: "FULL",
          role: "운영",
          prev_assignee: "a@x.com",
          next_assignee: "b@x.com",
          source: "manual",
          actor_email: "admin@x.com",
        },
      ]);
    });

    it("비우면 next 가 null 인 이력을 남긴다 — 퇴사하면 칸을 비운다", async () => {
      const r = okUpdate(
        await updateAssignment(
          input([
            {
              work_kind: "PIMS",
              subtype: "FULL",
              role: "운영",
              assignee_email: null,
              assignee_name: "",
            },
          ]),
        ),
      );

      expect(r.history).toBe(1);
      expect(h.insert.mock.calls[0][0]).toMatchObject([
        { prev_assignee: "a@x.com", next_assignee: null },
      ]);
      // 비우기는 명부 조회가 필요 없다.
      expect(operatorsIn).not.toHaveBeenCalled();
    });

    /**
     * FK(`assignee_email references operators(email)`)가 `23503` 으로 막는다 —
     * 그 코드를 그대로 올리면 사람은 무슨 뜻인지 모른다. 먼저 보고 말로 돌려준다(F14).
     */
    it("명부에 없는 주소면 쓰지 않고 '연결 안 됨' 으로 돌려준다", async () => {
      operatorsIn.mockResolvedValue({ data: [], error: null });

      const r = await updateAssignment(input([SWAP]));

      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("연결 안 됨");
      expect(h.upsert).not.toHaveBeenCalled();
    });
  });

  /**
   * 개발자는 `operators` 에 없다(운영부 표다). 이력의 단위가 이메일이라
   * **개발 칸 편집은 이력에 남지 않는다** — 사용자 결정 2026-09-17. 이름만 고친다.
   */
  describe("개발 칸", () => {
    it("이름만 바꾸고 이력은 남기지 않는다", async () => {
      ledgerEqUniv.mockResolvedValue({
        data: [
          currentCell({
            role: "개발",
            assignee_email: null,
            assignee_name: "가개발",
          }),
        ],
        error: null,
      });

      const r = okUpdate(
        await updateAssignment(
          input([
            {
              work_kind: "PIMS",
              subtype: "FULL",
              role: "개발",
              assignee_email: null,
              assignee_name: "나개발",
            },
          ]),
        ),
      );

      expect(r.changed).toBe(1);
      expect(r.history).toBe(0);
      expect(h.insert).not.toHaveBeenCalled();
      const [row] = h.upsert.mock.calls[0][0] as { assignee_name: string }[];
      expect(row.assignee_name).toBe("나개발");
    });
  });

  describe("실패", () => {
    it("원장 쓰기가 실패하면 이력을 적재하지 않는다", async () => {
      // supabase-js 는 던지지 않는다. 삼키면 저장했다고 띄우고 끝난다.
      h.upsert.mockResolvedValue({ error: { message: "boom" } });

      const r = await updateAssignment(input([SWAP]));

      expect(r.ok).toBe(false);
      expect(h.insert).not.toHaveBeenCalled();
    });

    it("이력만 실패하면 원장은 들어갔다고 구분해 알린다", async () => {
      // PostgREST 는 호출 간 트랜잭션이 없다. 다시 눌러도 채워지지 않는다
      // (이전 상태가 이미 바뀌었다) — 그래서 메시지가 달라야 한다.
      h.insert.mockResolvedValue({ error: { message: "boom" } });

      const r = await updateAssignment(input([SWAP]));

      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain("원장은");
    });

    it("이전값 조회가 실패하면 쓰지 않는다", async () => {
      ledgerEqUniv.mockResolvedValue({
        data: null,
        error: { message: "boom" },
      });

      const r = await updateAssignment(input([SWAP]));

      expect(r.ok).toBe(false);
      expect(h.upsert).not.toHaveBeenCalled();
    });
  });

  it("바꿨으면 두 화면을 다시 그린다 — 원장은 배분현황도 떠받친다", async () => {
    /*
     * 원장이 바뀌면 총괄장 대학배정과 업무배정 배분현황이 함께 낡는다. #1205 가
     * 라우트를 나눈 뒤 옛 주소만 남아, 배정을 고쳐도 배분현황의 대학 수·건수가
     * 예전 값으로 보인다 — 그 표가 판정의 근거라 조용히 어긋나면 잡을 길이 없다.
     */
    await updateAssignment(input([SWAP]));
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard/assignments");
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard/work-assignment");
  });
});
// ─────────────────────────────────────────────────────────────
// 되돌리기 — `revertChange`
// ─────────────────────────────────────────────────────────────

const changeEqId = vi.fn();
const changeMaybeSingle = vi.fn();

const CHANGE_ID = "22222222-2222-4222-8222-222222222222";

/** 이력 한 줄 — a@x.com 이 b@x.com 으로 바뀐 기록. */
function changeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: CHANGE_ID,
    academic_year: 2027,
    university_name: "서울대학교",
    work_kind: "PIMS",
    subtype: "FULL",
    role: "운영",
    prev_assignee: "a@x.com",
    next_assignee: "b@x.com",
    source: "manual",
    actor_email: "admin@x.com",
    changed_at: "2026-09-16T01:00:00.000Z",
    ...overrides,
  };
}

/**
 * **되돌리기는 삭제가 아니다**(마이그레이션 주석). 원장을 `prev_assignee` 로 바꾸고
 * `source='revert'` 인 **새 이력 행**을 남긴다 — 이력을 지우는 경로는 만들지 않는다.
 * 지우면 "이 칸이 왜 이 사람인가" 를 설명할 수 없고, 되돌리기를 되돌릴 수도 없다.
 */
describe("revertChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getCurrentOperator.mockResolvedValue(ADMIN);
    h.createAdminClient.mockReturnValue({ from: h.adminFrom });
    h.adminFrom.mockImplementation((table: string) => {
      if (table === "assignments")
        return { select: h.ledgerSelect, upsert: h.upsert };
      if (table === "operators") return { select: h.operatorsSelect };
      if (table === "assignment_changes")
        return { select: h.changeSelect, insert: h.insert };
      throw new Error(`예상치 못한 테이블: ${table}`);
    });
    h.changeSelect.mockReturnValue({ eq: changeEqId });
    changeEqId.mockReturnValue({ maybeSingle: changeMaybeSingle });
    changeMaybeSingle.mockResolvedValue({ data: changeRecord(), error: null });
    // 원장은 이력이 남긴 그대로(b@x.com) 있다 — 그 뒤로 아무도 안 고쳤다.
    h.ledgerSelect.mockReturnValue({ eq: ledgerEqYear });
    ledgerEqYear.mockReturnValue({ eq: ledgerEqUniv });
    ledgerEqUniv.mockResolvedValue({
      data: [
        currentCell({ assignee_email: "b@x.com", assignee_name: "나운영" }),
      ],
      error: null,
    });
    h.operatorsSelect.mockReturnValue({ in: operatorsIn });
    operatorsIn.mockResolvedValue({
      data: [{ email: "a@x.com", name: "가운영" }],
      error: null,
    });
    h.upsert.mockResolvedValue({ error: null });
    h.insert.mockResolvedValue({ error: null });
  });

  it("admin 이 아니면 admin 클라이언트조차 만들지 않는다", async () => {
    h.getCurrentOperator.mockResolvedValue({ ...ADMIN, permission: "member" });

    const r = await revertChange(CHANGE_ID);

    expect(r.ok).toBe(false);
    expect(h.createAdminClient).not.toHaveBeenCalled();
  });

  it("원장을 이전 담당자로 바꾸고 새 이력 행을 남긴다 — 지우지 않는다", async () => {
    const r = await revertChange(CHANGE_ID);

    expect(r.ok).toBe(true);
    expect(h.upsert.mock.calls[0][0]).toEqual([
      {
        academic_year: 2027,
        university_name: "서울대학교",
        work_kind: "PIMS",
        subtype: "FULL",
        role: "운영",
        assignee_email: "a@x.com",
        assignee_name: "가운영",
        updated_by: "admin@x.com",
      },
    ]);
    expect(h.insert.mock.calls[0][0]).toEqual([
      {
        academic_year: 2027,
        university_name: "서울대학교",
        work_kind: "PIMS",
        subtype: "FULL",
        role: "운영",
        prev_assignee: "b@x.com",
        next_assignee: "a@x.com",
        source: "revert",
        actor_email: "admin@x.com",
      },
    ]);
  });

  it("자연키로 쓴다 — 같은 칸이 두 행이 되면 안 된다", async () => {
    await revertChange(CHANGE_ID);
    expect(h.upsert.mock.calls[0][1]).toMatchObject({
      onConflict: "academic_year,university_name,work_kind,subtype,role",
    });
  });

  /**
   * **F14** — `operators` 의 이메일이 바뀌거나 지워지면 FK 가 원장을 따라 고치거나
   * 비우지만, 이력 칸은 FK 없는 스냅샷이라 그대로 남는다. 그 주소로 되돌리면
   * `23503` 이다. 쓰지 않고 말로 돌려준다.
   */
  it("되돌릴 주소가 명부에 없으면 쓰지 않고 '연결 안 됨' 으로 돌려준다", async () => {
    operatorsIn.mockResolvedValue({ data: [], error: null });

    const r = await revertChange(CHANGE_ID);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("연결 안 됨");
    expect(h.upsert).not.toHaveBeenCalled();
    expect(h.insert).not.toHaveBeenCalled();
  });

  /**
   * 되돌리기는 **그 변경 직후 상태**를 되돌리는 것이다. 그 뒤에 누가 또 고쳤다면
   * 지금 되돌리면 남의 변경을 말없이 덮는다 — 이력에는 '되돌림' 으로만 남아
   * 무엇이 사라졌는지 알 수 없다.
   */
  it("그 뒤에 또 바뀌었으면 거부한다", async () => {
    ledgerEqUniv.mockResolvedValue({
      data: [
        currentCell({ assignee_email: "c@x.com", assignee_name: "딴사람" }),
      ],
      error: null,
    });

    const r = await revertChange(CHANGE_ID);

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("그 뒤");
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("빈 칸으로 되돌리는 것도 된다 — 이관 이력은 prev 가 null 이다", async () => {
    // 라이브 원장의 이관 행 966개가 전부 prev=null 이다. 되돌리면 칸이 비고,
    // 그 비움 자체가 이력에 남는다.
    changeMaybeSingle.mockResolvedValue({
      data: changeRecord({ prev_assignee: null, source: "import" }),
      error: null,
    });

    const r = await revertChange(CHANGE_ID);

    expect(r.ok).toBe(true);
    expect(h.upsert.mock.calls[0][0]).toMatchObject([
      { assignee_email: null, assignee_name: "" },
    ]);
    expect(h.insert.mock.calls[0][0]).toMatchObject([
      { prev_assignee: "b@x.com", next_assignee: null, source: "revert" },
    ]);
    // 비우기는 명부 조회가 필요 없다.
    expect(operatorsIn).not.toHaveBeenCalled();
  });

  it("없는 이력이면 거부한다", async () => {
    changeMaybeSingle.mockResolvedValue({ data: null, error: null });

    const r = await revertChange(CHANGE_ID);

    expect(r.ok).toBe(false);
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("id 모양이 아니면 조회조차 하지 않는다", async () => {
    const r = await revertChange("아무말");
    expect(r.ok).toBe(false);
    expect(h.changeSelect).not.toHaveBeenCalled();
  });

  it("원장에서 칸이 사라졌으면 거부한다", async () => {
    ledgerEqUniv.mockResolvedValue({ data: [], error: null });

    const r = await revertChange(CHANGE_ID);

    expect(r.ok).toBe(false);
    expect(h.upsert).not.toHaveBeenCalled();
  });

  it("원장 쓰기가 실패하면 이력을 적재하지 않는다", async () => {
    h.upsert.mockResolvedValue({ error: { message: "boom" } });

    const r = await revertChange(CHANGE_ID);

    expect(r.ok).toBe(false);
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("되돌렸으면 두 화면을 다시 그린다", async () => {
    await revertChange(CHANGE_ID);
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard/assignments");
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard/work-assignment");
  });
});
// ─────────────────────────────────────────────────────────────
// 이관 — `importAssignments`
// ─────────────────────────────────────────────────────────────

/** 03. 대학원 — 올해 칸과 `前` 칸이 나란히 있다(라이브 실측 좌표). */
function gradSheetWithPrev(rows: string[][]) {
  return {
    worksheetName: SHEET_NAMES.대학원,
    rowsText: [
      ["대학명", "운영자", "개발자", "前 운영자", "前 개발자"],
      ...rows,
    ],
    rowCount: rows.length + 1,
    columnCount: 5,
  };
}

const PREV_GRAD = gradSheetWithPrev([
  ["서울대학교", "올해운영", "올해개발", "작년운영", "작년개발"],
]);

const operatorsSelectAll = vi.fn();

function okImport(r: ImportAssignmentsResult) {
  if (!r.ok) throw new Error(`실패로 돌아왔다: ${r.error}`);
  return r;
}

/** 원장에 쓴 payload 전부 — 나눠 쓰므로 호출을 합친다. */
function written(): Record<string, unknown>[] {
  return h.upsert.mock.calls.flatMap((c) => c[0] as Record<string, unknown>[]);
}

/** 이력에 쓴 행 전부. */
function historyWritten(): Record<string, unknown>[] {
  return h.insert.mock.calls.flatMap((c) => c[0] as Record<string, unknown>[]);
}

/** 원장 한 칸이 이미 들어가 있는 모양. */
function existing(role: string, email: string | null, name: string) {
  return {
    academic_year: BAEJUNG_PREV_YEAR,
    university_name: "서울대학교",
    work_kind: "대학원" as const,
    subtype: "",
    role,
    assignee_email: email,
    assignee_name: name,
  };
}

/**
 * 이관 — **시트에 있고 원장에 없는 칸만 만든다.**
 *
 * 설계 §13 R1 이 재가져오기를 만들지 않기로 한 것은(사용자 결정 2026-09-15) 자연키
 * upsert 가 **앱에서 고친 배정을 시트 값으로 되돌리고**, 그 덮어씀이 정당한 변경으로
 * 이력에 남아 사고로 구분할 수 없기 때문이다. 게다가 대조가 쓰기 뒤에 돌면 방금
 * 덮어쓴 원장과 시트를 비교해 0건으로 통과한다.
 *
 * 그래서 이 action 은 **덮어쓸 수 없는 모양**이다 — `ignoreDuplicates` 로 넣어
 * `ON CONFLICT DO NOTHING` 이 된다. 조심해서 안 덮는 것이 아니라 DB 가 못 덮게 한다.
 * 그 덕에 재실행도 안전하다: 반쯤 들어간 뒤 다시 눌러도 들어간 칸은 건드리지 않는다.
 */
describe("importAssignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getCurrentOperator.mockResolvedValue(ADMIN);
    h.fetchSheet.mockImplementation(async (name: string) =>
      name === SHEET_NAMES.대학원 ? PREV_GRAD : null,
    );
    h.listLedgerRows.mockResolvedValue([]);
    h.createAdminClient.mockReturnValue({ from: h.adminFrom });
    h.adminFrom.mockImplementation((table: string) => {
      if (table === "assignments") return { upsert: h.upsert };
      if (table === "operators") return { select: operatorsSelectAll };
      if (table === "assignment_changes") return { insert: h.insert };
      throw new Error(`예상치 못한 테이블: ${table}`);
    });
    operatorsSelectAll.mockResolvedValue({
      data: [
        { email: "last@x.com", name: "작년운영" },
        { email: "dev@x.com", name: "작년개발" },
      ],
      error: null,
    });
    h.upsert.mockResolvedValue({ error: null });
    h.insert.mockResolvedValue({ error: null });
  });

  describe("권한·입력", () => {
    it("admin 이 아니면 시트도 읽지 않는다", async () => {
      h.getCurrentOperator.mockResolvedValue({
        ...ADMIN,
        permission: "member",
      });

      const r = await importAssignments(BAEJUNG_PREV_YEAR);

      expect(r.ok).toBe(false);
      expect(h.fetchSheet).not.toHaveBeenCalled();
      expect(h.createAdminClient).not.toHaveBeenCalled();
    });

    it("비로그인이면 아무것도 쓰지 않는다", async () => {
      h.getCurrentOperator.mockResolvedValue(null);

      const r = await importAssignments(BAEJUNG_PREV_YEAR);

      expect(r.ok).toBe(false);
      expect(h.upsert).not.toHaveBeenCalled();
    });

    it("학년도가 범위를 벗어나면 조회하지 않는다", async () => {
      const r = await importAssignments(1999);

      expect(r.ok).toBe(false);
      expect(h.fetchSheet).not.toHaveBeenCalled();
    });

    it("시트에 없는 학년도는 쓰지 않는다 — 올해 칸을 그 해로 적재하면 안 된다", async () => {
      /*
       * 이 가드가 없으면 `2025` 가 올해 칸을 읽어 2025 로 들어간다. 자연키에 학년도가
       * 있어 충돌도 안 나고, 대조는 양쪽이 같은 시트에서 나오니 통과한다.
       */
      const r = await importAssignments(2025);

      expect(r.ok).toBe(false);
      expect(h.upsert).not.toHaveBeenCalled();
    });

    it("시트를 하나도 못 읽으면 실패로 돌려준다", async () => {
      h.fetchSheet.mockResolvedValue(null);

      const r = await importAssignments(BAEJUNG_PREV_YEAR);

      expect(r.ok).toBe(false);
      expect(h.upsert).not.toHaveBeenCalled();
    });

    it("원장 조회가 실패하면 쓰지 않는다 — 조용한 0건이면 전량을 다시 넣는다", async () => {
      h.listLedgerRows.mockRejectedValue(new Error("원장 조회 실패: boom"));

      const r = await importAssignments(BAEJUNG_PREV_YEAR);

      expect(r.ok).toBe(false);
      expect(h.upsert).not.toHaveBeenCalled();
    });
  });

  describe("덮어쓰지 않는다", () => {
    it("DB 가 못 덮게 넣는다 — `ignoreDuplicates` 가 곧 그 보증이다", async () => {
      await importAssignments(BAEJUNG_PREV_YEAR);

      expect(h.upsert.mock.calls[0][1]).toMatchObject({
        onConflict: "academic_year,university_name,work_kind,subtype,role",
        ignoreDuplicates: true,
      });
    });

    it("이미 원장에 있는 칸은 payload 에 넣지 않는다", async () => {
      h.listLedgerRows.mockResolvedValue([
        existing("운영", "someone@x.com", "손으로고친사람"),
      ]);

      const r = okImport(await importAssignments(BAEJUNG_PREV_YEAR));

      expect(r.skipped).toBe(1);
      expect(r.inserted).toBe(1); // 개발 칸만 새로 들어간다
      expect(written().map((w) => w.role)).toEqual(["개발"]);
    });

    it("앱에서 비운 칸을 되살리지 않는다", async () => {
      /*
       * 비우기는 행을 지우지 않고 이메일만 null 로 만든다(`updateAssignment`). 키가
       * 남아 있으므로 이관이 건너뛴다 — 안 그러면 비운 칸이 시트 값으로 되살아난다.
       */
      h.listLedgerRows.mockResolvedValue([existing("운영", null, "")]);

      const r = okImport(await importAssignments(BAEJUNG_PREV_YEAR));

      expect(written().map((w) => w.role)).not.toContain("운영");
      expect(r.skipped).toBe(1);
    });

    it("넣을 것이 없으면 쓰지 않는다 — 두 번 눌러도 이력이 안 늘어난다", async () => {
      h.listLedgerRows.mockResolvedValue([
        existing("운영", "last@x.com", "작년운영"),
        existing("개발", null, "작년개발"),
      ]);

      const r = okImport(await importAssignments(BAEJUNG_PREV_YEAR));

      expect(r.inserted).toBe(0);
      expect(r.skipped).toBe(2);
      expect(h.upsert).not.toHaveBeenCalled();
      expect(h.insert).not.toHaveBeenCalled();
    });
  });

  describe("적재", () => {
    it("전년도 칸을 읽어 그 학년도로 넣는다 — 올해 이름이 섞이지 않는다", async () => {
      const r = okImport(await importAssignments(BAEJUNG_PREV_YEAR));

      expect(r.inserted).toBe(2);
      const rows = written();
      expect(rows.every((w) => w.academic_year === BAEJUNG_PREV_YEAR)).toBe(
        true,
      );
      expect(rows.map((w) => w.assignee_name).sort()).toEqual([
        "작년개발",
        "작년운영",
      ]);
    });

    it("올해를 물으면 올해 칸을 넣는다 — 같은 버튼이 두 해를 다룬다", async () => {
      const r = okImport(await importAssignments(BAEJUNG_CURRENT_YEAR));

      expect(r.inserted).toBe(2);
      expect(
        written()
          .map((w) => w.assignee_name)
          .sort(),
      ).toEqual(["올해개발", "올해운영"]);
    });

    it("이름을 명부의 이메일로 잇는다 — 이메일이 비면 화면이 배정을 못 센다", async () => {
      const r = okImport(await importAssignments(BAEJUNG_PREV_YEAR));

      expect(written().find((w) => w.role === "운영")?.assignee_email).toBe(
        "last@x.com",
      );
      expect(r.linked).toBe(2);
    });

    it("명부에 없는 이름은 이름만 넣는다 — FK 가 23503 으로 전량을 죽인다", async () => {
      operatorsSelectAll.mockResolvedValue({ data: [], error: null });

      const r = okImport(await importAssignments(BAEJUNG_PREV_YEAR));

      expect(written().every((w) => w.assignee_email === null)).toBe(true);
      expect(r.linked).toBe(0);
      expect(r.inserted).toBe(2);
    });

    it("동명이인은 잇지 않고 이름을 알려준다 — 고치는 방법이 다르다", async () => {
      operatorsSelectAll.mockResolvedValue({
        data: [
          { email: "a1@x.com", name: "작년운영" },
          { email: "a2@x.com", name: "작년운영" },
        ],
        error: null,
      });

      const r = okImport(await importAssignments(BAEJUNG_PREV_YEAR));

      expect(r.ambiguousNames).toEqual(["작년운영"]);
      expect(
        written().find((w) => w.role === "운영")?.assignee_email,
      ).toBeNull();
    });

    it("명부 조회가 실패하면 쓰지 않는다 — 전량이 이름만으로 들어간다", async () => {
      operatorsSelectAll.mockResolvedValue({
        data: null,
        error: { message: "boom" },
      });

      const r = await importAssignments(BAEJUNG_PREV_YEAR);

      expect(r.ok).toBe(false);
      expect(h.upsert).not.toHaveBeenCalled();
    });

    it("누른 사람이 `updated_by` 다", async () => {
      await importAssignments(BAEJUNG_PREV_YEAR);

      expect(written().every((w) => w.updated_by === "admin@x.com")).toBe(true);
    });
  });

  describe("이력", () => {
    it("이메일이 붙은 칸만 남긴다 — prev 는 null 이고 출처는 `import` 다", async () => {
      /*
       * 라이브 원장의 2027 이관 행 966개가 전부 `prev=null`·`source=import` 다.
       * 되돌리기가 그 모양을 이미 받는다(`revertChange` 테스트).
       */
      await importAssignments(BAEJUNG_PREV_YEAR);

      expect(historyWritten()).toEqual([
        {
          academic_year: BAEJUNG_PREV_YEAR,
          university_name: "서울대학교",
          work_kind: "대학원",
          subtype: "",
          role: "운영",
          prev_assignee: null,
          next_assignee: "last@x.com",
          source: "import",
          actor_email: "admin@x.com",
        },
        {
          academic_year: BAEJUNG_PREV_YEAR,
          university_name: "서울대학교",
          work_kind: "대학원",
          subtype: "",
          role: "개발",
          prev_assignee: null,
          next_assignee: "dev@x.com",
          source: "import",
          actor_email: "admin@x.com",
        },
      ]);
    });

    it("이메일 없는 칸은 이력을 남기지 않는다 — prev=next=null 이 23514 다", async () => {
      operatorsSelectAll.mockResolvedValue({ data: [], error: null });

      await importAssignments(BAEJUNG_PREV_YEAR);

      expect(h.insert).not.toHaveBeenCalled();
    });

    it("원장 쓰기가 실패하면 이력을 적재하지 않는다", async () => {
      h.upsert.mockResolvedValue({ error: { message: "boom" } });

      const r = await importAssignments(BAEJUNG_PREV_YEAR);

      expect(r.ok).toBe(false);
      expect(h.insert).not.toHaveBeenCalled();
    });
  });

  it("많은 행은 나눠 쓴다 — 한 번에 밀면 요청이 통째로 실패한다", async () => {
    const many = Array.from({ length: 400 }, (_, i) => [
      `대학${i}`,
      "",
      "",
      "작년운영",
      "작년개발",
    ]);
    h.fetchSheet.mockImplementation(async (name: string) =>
      name === SHEET_NAMES.대학원 ? gradSheetWithPrev(many) : null,
    );

    const r = okImport(await importAssignments(BAEJUNG_PREV_YEAR));

    expect(r.inserted).toBe(800);
    expect(h.upsert.mock.calls.length).toBeGreaterThan(1);
    expect(
      h.upsert.mock.calls.every((c) => (c[0] as unknown[]).length <= 500),
    ).toBe(true);
  });

  it("넣었으면 두 화면을 다시 그린다 — 원장은 배분현황도 떠받친다", async () => {
    await importAssignments(BAEJUNG_PREV_YEAR);

    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard/assignments");
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard/work-assignment");
  });
});
