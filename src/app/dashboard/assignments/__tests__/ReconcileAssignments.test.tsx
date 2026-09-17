import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { reconcileSpy, result } = vi.hoisted(() => ({
  reconcileSpy: vi.fn(),
  result: { value: {} as unknown },
}));

vi.mock("@/features/assignments/actions", () => ({
  reconcileAssignments: (year: number) => {
    reconcileSpy(year);
    return Promise.resolve(result.value);
  },
}));

const { ReconcileAssignments } = await import("../ReconcileAssignments");

/**
 * **읽기 전용 대조 버튼**이다(설계 §13 R1 · 사용자 결정 2026-09-15).
 *
 * 원장에 쓰던 이관 버튼이 여기 있었다. 편집이 앱에서 일어나기 시작하면 그 버튼 한
 * 번이 앱 편집 전부를 시트 값으로 되돌리고, 그 덮어씀이 정당한 변경으로 이력에
 * 남아 사고로 구분되지 않는다. 그래서 **갈림을 만들지 않으면서 갈림을 탐지하는**
 * 쪽만 남겼다.
 *
 * 건수만 알리면 안 된다 — 통과 못 했을 때 **어느 칸인지**가 곧 조치다.
 */
const PASSING = {
  ok: true,
  issues: [],
  reconcile: {
    // 대학 수와 칸 수를 **다른 값으로** 둔다 — 같게 두면 한 숫자를 두 번 그리는
    // 실수를 잡지 못하고, findByText 가 다중 매치로 던진다.
    universities: { sheet: 286, ledger: 286 },
    cells: { sheet: 5720, ledger: 5720 },
    missingInLedger: [],
    extraInLedger: [],
    nameMismatch: [],
    mismatchCount: 0,
  },
};

const click = () =>
  fireEvent.click(screen.getByRole("button", { name: /원장 대조/ }));

describe("ReconcileAssignments", () => {
  beforeEach(() => {
    reconcileSpy.mockClear();
    result.value = PASSING;
  });

  it("누르기 전에는 돌지 않는다 — 시트 다섯 장을 읽는 버튼이다", () => {
    render(<ReconcileAssignments academicYear={2027} />);
    expect(reconcileSpy).not.toHaveBeenCalled();
  });

  it("누르면 그 학년도로 대조한다", async () => {
    render(<ReconcileAssignments academicYear={2027} />);
    click();
    await waitFor(() => expect(reconcileSpy).toHaveBeenCalledWith(2027));
  });

  /**
   * **쓰기가 걷혔다는 것이 화면에도 드러나야 한다.** 버튼 문구가 '이관' 이면 누르는
   * 사람은 시트를 원장에 밀어 넣는다고 믿고, 통과 보고를 '넣었다' 로 읽는다.
   */
  it("원장에 넣었다는 말을 하지 않는다", async () => {
    render(<ReconcileAssignments academicYear={2027} />);
    click();
    await screen.findByText(/대조 통과/);
    expect(screen.queryByText(/넣었습니다/)).toBeNull();
    expect(screen.queryByText(/이관/)).toBeNull();
  });

  it("양쪽 칸 수를 함께 보여준다 — 한쪽만 주면 어디가 모자란지 모른다", async () => {
    render(<ReconcileAssignments academicYear={2027} />);
    click();
    // 시트 한 줄 · 원장 한 줄. 통과한 날은 두 줄이 같은 숫자라, 한 줄만 그리면
    // 어긋난 날에야 티가 난다.
    expect(await screen.findAllByText(/5,720칸/)).toHaveLength(2);
    expect(screen.getAllByText(/286곳/)).toHaveLength(2);
  });

  it("대조를 통과하면 그렇다고 말한다", async () => {
    render(<ReconcileAssignments academicYear={2027} />);
    click();
    expect(await screen.findByText(/대조 통과/)).toBeInTheDocument();
  });

  it("대조 불일치를 어느 칸인지로 보여준다 — 건수만 주면 못 고친다", async () => {
    result.value = {
      ...PASSING,
      reconcile: {
        ...PASSING.reconcile,
        missingInLedger: ["2027|서울대학교|원서접수|수시|운영"],
        nameMismatch: [
          {
            key: "2027|고려대학교|PIMS|FULL|운영",
            sheet: "가운영",
            ledger: "나운영",
          },
        ],
        mismatchCount: 2,
      },
    };

    render(<ReconcileAssignments academicYear={2027} />);
    click();

    expect(await screen.findByText(/서울대학교/)).toBeInTheDocument();
    expect(screen.getByText(/고려대학교/)).toBeInTheDocument();
  });

  /**
   * 원장이 원천이므로 **고치는 쪽은 시트다** — 예전 문구("화면을 원장으로 바꾸기
   * 전에 0건이어야 합니다")는 교체가 끝난 뒤엔 뜻이 없다.
   */
  it("불일치가 있으면 어디를 고쳐야 하는지 말해준다", async () => {
    result.value = {
      ...PASSING,
      reconcile: { ...PASSING.reconcile, mismatchCount: 1 },
    };
    render(<ReconcileAssignments academicYear={2027} />);
    click();
    expect(await screen.findByText(/원장이 원천/)).toBeInTheDocument();
  });

  it("사람이 봐야 하는 자리를 대학 이름으로 보여준다", async () => {
    result.value = {
      ...PASSING,
      issues: [
        {
          kind: "duplicate-conflict",
          university: "연세대학교",
          detail: "PIMS · FULL · 운영 칸에 이름이 둘이다 — 뒤에 온 값을 쓴다.",
        },
      ],
    };
    render(<ReconcileAssignments academicYear={2027} />);
    click();
    expect(await screen.findByText(/연세대학교/)).toBeInTheDocument();
  });

  it("실패하면 사유를 그대로 보여준다", async () => {
    result.value = { ok: false, error: "총괄장을 읽지 못했습니다" };
    render(<ReconcileAssignments academicYear={2027} />);
    click();
    expect(
      await screen.findByText(/총괄장을 읽지 못했습니다/),
    ).toBeInTheDocument();
  });
});
