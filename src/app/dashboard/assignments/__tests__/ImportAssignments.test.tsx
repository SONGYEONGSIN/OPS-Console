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
  unresolvedOperatorNames: [],
  unresolvedDeveloperCount: 0,
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

  it("이름을 못 맞춘 운영자를 이름으로 보여준다 — 숫자만 주면 다 된 줄 안다", async () => {
    result.value = {
      ...PASSING,
      unresolvedOperatorNames: ["김없음", "이중복"],
    };
    render(<ImportAssignments academicYear={2027} />);
    fireEvent.click(screen.getByRole("button", { name: /원장 이관/ }));
    expect(await screen.findByText(/김없음/)).toBeInTheDocument();
    expect(screen.getByText(/이중복/)).toBeInTheDocument();
  });

  /**
   * 라이브에서 27개가 떴는데 26개가 개발자였다(2026-09-15). 개발부는 `operators`
   * 에 없는 게 정상이라 **고칠 것이 없는데 '맞춰 주세요' 를 붙여 놨었다.** 매번
   * 같은 목록이 뜨면 진짜 신호가 묻힌다.
   */
  it("개발자 미매칭은 이름 목록이 아니라 한 줄 건수로 알린다 — 고칠 것이 아니다", async () => {
    result.value = { ...PASSING, unresolvedDeveloperCount: 26 };
    render(<ImportAssignments academicYear={2027} />);
    fireEvent.click(screen.getByRole("button", { name: /원장 이관/ }));

    expect(await screen.findByText(/개발자/)).toBeInTheDocument();
    expect(screen.getByText("26")).toBeInTheDocument();
    // 조치를 요구하는 문구가 붙으면 안 된다 — 고칠 것이 없다.
    expect(screen.queryByText(/맞춰 주세요/)).toBeNull();
  });

  it("운영자 미매칭이 없으면 그 칸을 아예 안 그린다", async () => {
    result.value = { ...PASSING, unresolvedDeveloperCount: 26 };
    render(<ImportAssignments academicYear={2027} />);
    fireEvent.click(screen.getByRole("button", { name: /원장 이관/ }));

    await screen.findByText(/개발자/);
    expect(screen.queryByText(/못 맞춘 운영자/)).toBeNull();
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
