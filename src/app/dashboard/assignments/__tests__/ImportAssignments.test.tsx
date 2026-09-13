import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { importSpy, result } = vi.hoisted(() => ({
  importSpy: vi.fn(),
  result: { value: {} as unknown },
}));

vi.mock("@/features/assignments/actions", () => ({
  importAssignments: (year: number) => {
    importSpy(year);
    return Promise.resolve(result.value);
  },
}));

const { ImportAssignments } = await import("../ImportAssignments");

/**
 * 이관은 **화면 교체(PR4) 전에 한 번 도는 버튼**이다(설계 §10 사람 체크리스트 4).
 *
 * 건수만 알리면 안 된다 — 설계 §9.1 이 "대조를 통과해야 한다" 로 못 박은 것이
 * 이 화면의 판정이고, **통과 못 한 경우 어느 칸인지**가 곧 조치다. 이름을 못 맞춘
 * 칸도 반드시 보여야 한다(`SyncAnnouncementOperators` 가 같은 것을 배웠다 —
 * 숫자만 주면 "다 됐다" 로 읽히는데 그 대학들은 아무에게도 안 잡힌다).
 */
const PASSING = {
  ok: true,
  rows: 5720,
  // 칸 수와 이력 줄 수를 **다른 값으로** 둔다 — 같게 두면 한 숫자를 두 번 그리는
  // 실수를 잡지 못하고, findByText 가 다중 매치로 던진다.
  history: 4200,
  unresolvedNames: [],
  issues: [],
  reconcile: {
    universities: { sheet: 286, ledger: 286 },
    cells: { sheet: 5720, ledger: 5720 },
    missingInLedger: [],
    extraInLedger: [],
    nameMismatch: [],
    mismatchCount: 0,
  },
};

describe("ImportAssignments", () => {
  beforeEach(() => {
    importSpy.mockClear();
    result.value = PASSING;
  });

  it("누르기 전에는 돌지 않는다 — 원장을 건드리는 버튼이다", () => {
    render(<ImportAssignments academicYear={2027} />);
    expect(importSpy).not.toHaveBeenCalled();
  });

  it("누르면 그 학년도로 이관한다", async () => {
    render(<ImportAssignments academicYear={2027} />);
    fireEvent.click(screen.getByRole("button", { name: /원장 이관/ }));
    await waitFor(() => expect(importSpy).toHaveBeenCalledWith(2027));
  });

  it("넣은 칸 수와 이력 줄 수를 알린다", async () => {
    render(<ImportAssignments academicYear={2027} />);
    fireEvent.click(screen.getByRole("button", { name: /원장 이관/ }));
    expect(await screen.findByText(/5,720/)).toBeInTheDocument();
    expect(screen.getByText(/4,200/)).toBeInTheDocument();
  });

  it("대조를 통과하면 그렇다고 말한다", async () => {
    render(<ImportAssignments academicYear={2027} />);
    fireEvent.click(screen.getByRole("button", { name: /원장 이관/ }));
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

    render(<ImportAssignments academicYear={2027} />);
    fireEvent.click(screen.getByRole("button", { name: /원장 이관/ }));

    expect(await screen.findByText(/서울대학교/)).toBeInTheDocument();
    expect(screen.getByText(/고려대학교/)).toBeInTheDocument();
  });

  it("이름을 못 맞춘 칸을 이름으로 보여준다 — 숫자만 주면 다 된 줄 안다", async () => {
    result.value = { ...PASSING, unresolvedNames: ["김없음", "이중복"] };
    render(<ImportAssignments academicYear={2027} />);
    fireEvent.click(screen.getByRole("button", { name: /원장 이관/ }));
    expect(await screen.findByText(/김없음/)).toBeInTheDocument();
    expect(screen.getByText(/이중복/)).toBeInTheDocument();
  });

  it("파서가 보고한 모호함을 보여준다 — 추측해 채우지 않은 자리다", async () => {
    result.value = {
      ...PASSING,
      issues: [
        {
          kind: "pims-ambiguous",
          university: "연세대학교",
          detail:
            "FULL 과 환/충 이 같은 값으로 읽혀 FULL 배정 여부를 가릴 수 없다.",
        },
      ],
    };
    render(<ImportAssignments academicYear={2027} />);
    fireEvent.click(screen.getByRole("button", { name: /원장 이관/ }));
    expect(await screen.findByText(/연세대학교/)).toBeInTheDocument();
  });

  it("실패하면 사유를 그대로 보여준다", async () => {
    result.value = { ok: false, error: "총괄장을 읽지 못했습니다" };
    render(<ImportAssignments academicYear={2027} />);
    fireEvent.click(screen.getByRole("button", { name: /원장 이관/ }));
    expect(
      await screen.findByText(/총괄장을 읽지 못했습니다/),
    ).toBeInTheDocument();
  });
});
