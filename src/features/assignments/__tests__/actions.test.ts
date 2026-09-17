import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  getCurrentOperator: vi.fn(),
  fetchSheet: vi.fn(),
  listLedgerRows: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
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
  type ReconcileAssignmentsResult,
} from "../actions";
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
