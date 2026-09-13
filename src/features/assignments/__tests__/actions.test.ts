import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getCurrentOperator: vi.fn(),
  fetchSheet: vi.fn(),
  listLedgerRows: vi.fn(),
  from: vi.fn(),
  selectOperators: vi.fn(),
  upsert: vi.fn(),
  insert: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: h.revalidatePath }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: h.from }),
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

import { importAssignments, type ImportAssignmentsResult } from "../actions";
import { SHEET_NAMES } from "../queries";

/**
 * 이관 action 은 **조립과 판정**을 한다 — 파싱은 `parse.ts`, 행 변환은 `import.ts`,
 * 대조는 `reconcile` 이 각자 시험받았다. 여기서 보는 것은 그 사이를 잇는 배선이다:
 * 권한 · 시트 다섯 · 이름→이메일 · 자연키 upsert · 이력 · 쓴 뒤 대조.
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

/** PIMS 한 칸이 원장에 들어간 모양 — 이력 비교의 '이전 상태' 로 쓴다. */
function ledgerCell(email: string | null, name: string) {
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

function ok(r: ImportAssignmentsResult) {
  if (!r.ok) throw new Error(`실패로 돌아왔다: ${r.error}`);
  return r;
}

describe("importAssignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getCurrentOperator.mockResolvedValue(ADMIN);
    h.fetchSheet.mockImplementation(async (name: string) =>
      name === SHEET_NAMES.PIMS ? PIMS_SHEET : null,
    );
    h.selectOperators.mockResolvedValue({
      data: [{ email: "a@x.com", name: "가운영" }],
      error: null,
    });
    h.listLedgerRows.mockResolvedValue([]);
    h.upsert.mockResolvedValue({ error: null });
    h.insert.mockResolvedValue({ error: null });
    h.from.mockImplementation((table: string) => {
      if (table === "operators") return { select: h.selectOperators };
      if (table === "assignments") return { upsert: h.upsert };
      if (table === "assignment_changes") return { insert: h.insert };
      throw new Error(`예상치 못한 테이블: ${table}`);
    });
  });

  describe("권한·입력", () => {
    it("admin 이 아니면 시트도 읽지 않는다", async () => {
      h.getCurrentOperator.mockResolvedValue({
        ...ADMIN,
        permission: "member",
      });

      const r = await importAssignments(2027);

      expect(r.ok).toBe(false);
      expect(h.fetchSheet).not.toHaveBeenCalled();
      expect(h.upsert).not.toHaveBeenCalled();
    });

    it("비로그인이면 아무것도 하지 않는다", async () => {
      h.getCurrentOperator.mockResolvedValue(null);
      const r = await importAssignments(2027);
      expect(r.ok).toBe(false);
      expect(h.upsert).not.toHaveBeenCalled();
    });

    it("학년도가 범위를 벗어나면 아무것도 쓰지 않는다", async () => {
      // 자연키에 학년도가 있어, 이상한 값이 들어가면 아무도 안 보는 섬이 생긴다.
      const r = await importAssignments(1999);
      expect(r.ok).toBe(false);
      expect(h.upsert).not.toHaveBeenCalled();
    });
  });

  describe("시트 읽기", () => {
    it("다섯 시트를 모두 읽는다", async () => {
      await importAssignments(2027);
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
      // 0건 성공으로 끝내면 '총괄장에 배정이 없다' 로 읽힌다.
      h.fetchSheet.mockResolvedValue(null);
      const r = await importAssignments(2027);
      expect(r.ok).toBe(false);
      expect(h.upsert).not.toHaveBeenCalled();
    });

    it("시트마다 맞는 파서로 간다 — PIMS 와 대학원이 각자 work_kind 로 들어간다", async () => {
      h.fetchSheet.mockImplementation(async (name: string) => {
        if (name === SHEET_NAMES.PIMS) return PIMS_SHEET;
        if (name === SHEET_NAMES.대학원) return GRAD_SHEET;
        return null;
      });

      await importAssignments(2027);

      const payload = h.upsert.mock.calls[0][0] as { work_kind: string }[];
      expect([...new Set(payload.map((r) => r.work_kind))].sort()).toEqual([
        "PIMS",
        "대학원",
      ]);
    });
  });

  describe("원장 쓰기", () => {
    it("자연키로 upsert 한다 — 다시 돌려도 행이 늘지 않는다", async () => {
      await importAssignments(2027);
      expect(h.upsert.mock.calls[0][1]).toMatchObject({
        onConflict: "academic_year,university_name,work_kind,subtype,role",
      });
    });

    it("이름을 이메일로 바꿔 넣고 이름 스냅샷도 남긴다", async () => {
      const r = ok(await importAssignments(2027));

      expect(r.rows).toBe(1);
      expect(h.upsert.mock.calls[0][0]).toEqual([
        {
          academic_year: 2027,
          university_name: "서울대학교",
          work_kind: "PIMS",
          subtype: "FULL",
          role: "운영",
          assignee_email: "a@x.com",
          assignee_name: "가운영",
          university_type: null,
          updated_by: "admin@x.com",
        },
      ]);
    });

    it("못 맞춘 이름은 이메일 없이 이름만 남기고 보고한다", async () => {
      // F2: 미배정·미매칭은 설계가 정상으로 인정한 상태다. 이름 스냅샷은 남는다.
      h.selectOperators.mockResolvedValue({ data: [], error: null });

      const r = ok(await importAssignments(2027));

      const [row] = h.upsert.mock.calls[0][0] as {
        assignee_email: string | null;
        assignee_name: string;
      }[];
      expect(row.assignee_email).toBeNull();
      expect(row.assignee_name).toBe("가운영");
      expect(r.unresolvedNames).toEqual(["가운영"]);
    });

    it("이름이 둘 이상에 걸리면 맞추지 않는다 — 추측해 채우지 않는다", async () => {
      h.selectOperators.mockResolvedValue({
        data: [
          { email: "a@x.com", name: "가운영" },
          { email: "b@x.com", name: "가운영" },
        ],
        error: null,
      });

      const r = ok(await importAssignments(2027));

      const [row] = h.upsert.mock.calls[0][0] as {
        assignee_email: string | null;
      }[];
      expect(row.assignee_email).toBeNull();
      expect(r.unresolvedNames).toEqual(["가운영"]);
    });

    it("행이 많으면 나눠 넣는다 — 설계가 세는 한 해 물량이 5,720행이다", async () => {
      const rows = Array.from({ length: 501 }, (_, i) => [
        `대학${i + 1}`,
        "가운영",
        "",
      ]);
      h.fetchSheet.mockImplementation(async (name: string) =>
        name === SHEET_NAMES.대학원
          ? {
              worksheetName: SHEET_NAMES.대학원,
              rowsText: [["대학명", "운영자", "개발자"], ...rows],
              rowCount: rows.length + 1,
              columnCount: 3,
            }
          : null,
      );

      const r = ok(await importAssignments(2027));

      expect(r.rows).toBe(501);
      expect(h.upsert.mock.calls.length).toBeGreaterThan(1);
    });

    it("원장 쓰기가 실패하면 실패로 돌려준다", async () => {
      // supabase-js 는 던지지 않는다. 삼키면 '이관 완료' 로 보고하고 끝난다.
      h.upsert.mockResolvedValue({ error: { message: "boom" } });
      const r = await importAssignments(2027);
      expect(r.ok).toBe(false);
      expect(h.insert).not.toHaveBeenCalled();
    });
  });

  describe("이력", () => {
    it("빈 칸이 채워지면 prev=null 로 남긴다", async () => {
      const r = ok(await importAssignments(2027));

      expect(r.history).toBe(1);
      expect(h.insert.mock.calls[0][0]).toEqual([
        {
          academic_year: 2027,
          university_name: "서울대학교",
          work_kind: "PIMS",
          subtype: "FULL",
          role: "운영",
          prev_assignee: null,
          next_assignee: "a@x.com",
          source: "import",
          actor_email: "admin@x.com",
        },
      ]);
    });

    it("담당자가 바뀌면 prev·next 를 이메일로 남긴다", async () => {
      h.listLedgerRows.mockResolvedValue([ledgerCell("old@x.com", "옛운영")]);

      ok(await importAssignments(2027));

      expect(h.insert.mock.calls[0][0]).toMatchObject([
        { prev_assignee: "old@x.com", next_assignee: "a@x.com" },
      ]);
    });

    it("안 바뀐 칸은 이력에 남기지 않는다 — 다시 돌려도 이력이 늘지 않는다", async () => {
      h.listLedgerRows.mockResolvedValue([ledgerCell("a@x.com", "가운영")]);

      const r = ok(await importAssignments(2027));

      expect(r.history).toBe(0);
      expect(h.insert).not.toHaveBeenCalled();
    });

    it("이메일을 못 맞춘 칸은 이력에 남기지 않는다", async () => {
      // prev=next=null 이 되어 `assignment_changes_actual_change_chk` 가 23514 로
      // 트랜잭션을 통째로 죽인다. 이름만으로는 이력을 남길 수 없다.
      h.selectOperators.mockResolvedValue({ data: [], error: null });

      const r = ok(await importAssignments(2027));

      expect(r.history).toBe(0);
      expect(h.insert).not.toHaveBeenCalled();
    });
  });

  describe("대조", () => {
    it("쓴 뒤의 원장으로 대조한다", async () => {
      // 쓰기 전 상태로 대조하면 방금 넣은 행이 전부 '원장에 없음' 으로 나온다.
      h.listLedgerRows
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([ledgerCell("a@x.com", "가운영")]);

      const r = ok(await importAssignments(2027));

      expect(h.listLedgerRows).toHaveBeenCalledTimes(2);
      expect(r.reconcile.mismatchCount).toBe(0);
      expect(r.reconcile.cells).toEqual({ sheet: 1, ledger: 1 });
    });

    it("이관이 일부만 들어가면 대조가 드러낸다", async () => {
      h.listLedgerRows.mockResolvedValue([]);

      const r = ok(await importAssignments(2027));

      expect(r.reconcile.mismatchCount).toBe(1);
      expect(r.reconcile.missingInLedger[0]).toContain("서울대학교");
    });

    it("파서가 가린 PIMS 모호성을 함께 돌려준다", async () => {
      h.fetchSheet.mockImplementation(async (name: string) =>
        name === SHEET_NAMES.PIMS
          ? {
              ...PIMS_SHEET,
              rowsText: [
                ["대학명", "운영자 FULL", "운영자 환/충"],
                ["서울대학교", "가운영", "가운영"],
              ],
            }
          : null,
      );

      const r = ok(await importAssignments(2027));

      expect(r.issues).toHaveLength(1);
      expect(r.issues[0].kind).toBe("pims-ambiguous");
    });
  });

  it("대학배정 화면을 다시 그린다", async () => {
    await importAssignments(2027);
    expect(h.revalidatePath).toHaveBeenCalledWith("/dashboard/assignments");
  });
});
