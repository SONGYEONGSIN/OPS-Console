import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const importAssignments = vi.fn();
vi.mock("@/features/assignments/actions", () => ({
  importAssignments: (...a: unknown[]) => importAssignments(...a),
}));

import { ImportLedgerYear } from "../ImportLedgerYear";
import { HEADER_ACTION_CLASS } from "@/components/common/HeaderActionButton";

/**
 * 총괄장 → 원장 **적재** 버튼.
 *
 * 설계 §13 R1 이 재가져오기를 만들지 않기로 한 뒤(사용자 결정 2026-09-15) 앱에는
 * 원장에 쓰는 경로가 편집기뿐이었다. 그래서 **원장에 아예 없는 학년도**를 채울
 * 수단이 없었고, 과거 배분현황은 2026-02-28 에 멈춘 시트 임포트(`services`)를
 * 우회로로 보고 있었다.
 *
 * 이 버튼은 그 재가져오기가 아니다 — **덮어쓸 수 없다**(`ON CONFLICT DO NOTHING`).
 * 화면이 그 사실을 말해야 한다: 넣은 것과 **건드리지 않은 것**을 따로 보여준다.
 */
const OK = {
  ok: true as const,
  inserted: 1801,
  skipped: 0,
  linked: 1786,
  ambiguousNames: [],
  issues: [],
};

describe("ImportLedgerYear", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    importAssignments.mockResolvedValue(OK);
  });

  it("고른 학년도를 그대로 넘긴다 — 기본값으로 메우면 다른 해에 쓴다", async () => {
    render(<ImportLedgerYear academicYear={2026} />);
    fireEvent.click(screen.getByRole("button", { name: /적재/ }));

    await waitFor(() => expect(importAssignments).toHaveBeenCalledWith(2026));
  });

  it("누르는 동안 다시 눌리지 않는다 — 두 번 누르면 이력이 두 벌이 된다", async () => {
    let release: (v: unknown) => void = () => {};
    importAssignments.mockReturnValue(
      new Promise((r) => {
        release = r;
      }),
    );

    render(<ImportLedgerYear academicYear={2026} />);
    const btn = screen.getByRole("button", { name: /적재/ });
    fireEvent.click(btn);

    await waitFor(() => expect(btn).toHaveProperty("disabled", true));
    release(OK);
  });

  it("넣은 것과 건드리지 않은 것을 따로 보여준다", async () => {
    importAssignments.mockResolvedValue({
      ...OK,
      inserted: 12,
      skipped: 1789,
    });

    render(<ImportLedgerYear academicYear={2026} />);
    fireEvent.click(screen.getByRole("button", { name: /적재/ }));

    expect(await screen.findByText(/새로 넣음/)).toBeTruthy();
    expect(screen.getByText(/1,789/)).toBeTruthy();
  });

  it("0건도 성공이라고 말한다 — 두 번 눌렀을 때 실패로 보이면 안 된다", async () => {
    importAssignments.mockResolvedValue({
      ...OK,
      inserted: 0,
      skipped: 1801,
      linked: 0,
    });

    render(<ImportLedgerYear academicYear={2026} />);
    fireEvent.click(screen.getByRole("button", { name: /적재/ }));

    const msg = await screen.findByText(/새로 넣음/);
    expect(msg.className).not.toMatch(/vermilion/);
  });

  it("이름만 들어간 칸 수를 알려준다 — 그 칸은 화면에서 부하로 안 세어진다", async () => {
    importAssignments.mockResolvedValue({
      ...OK,
      inserted: 100,
      linked: 90,
    });

    render(<ImportLedgerYear academicYear={2026} />);
    fireEvent.click(screen.getByRole("button", { name: /적재/ }));

    // 100 − 90 = 10칸이 이름만이다. 합만 보여주면 그 10칸이 안 보인다.
    expect(await screen.findByText(/이름만/)).toBeTruthy();
  });

  it("동명이인은 이름을 그대로 보여준다 — 사람이 골라야 한다", async () => {
    importAssignments.mockResolvedValue({
      ...OK,
      ambiguousNames: ["가나다"],
    });

    render(<ImportLedgerYear academicYear={2026} />);
    fireEvent.click(screen.getByRole("button", { name: /적재/ }));

    expect(await screen.findByText("가나다")).toBeTruthy();
  });

  it("실패는 사유를 그대로 붉게 적는다 — 왜 안 됐는지가 조치다", async () => {
    importAssignments.mockResolvedValue({
      ok: false,
      error: "총괄장에서 2025학년도 배정 칸을 찾지 못했습니다",
    });

    render(<ImportLedgerYear academicYear={2025} />);
    fireEvent.click(screen.getByRole("button", { name: /적재/ }));

    const msg = await screen.findByText(/찾지 못했습니다/);
    expect(msg.className).toMatch(/vermilion/);
  });

  it("표준 액션 버튼 모양이다 — 이 화면만 다른 버튼을 쓰지 않는다", () => {
    /*
     * 레포의 액션 버튼은 **모양이 하나뿐이다**(`HEADER_ACTION_CLASS`). 문자열을
     * 새로 적는 순간 그게 두 번째 표준이 되고, 같은 일을 하는 버튼이 화면마다
     * 달라 보인다(#1047·#1049 가 그렇게 갈렸다).
     */
    render(<ImportLedgerYear academicYear={2026} />);

    expect(screen.getByRole("button", { name: /적재/ }).className).toBe(
      HEADER_ACTION_CLASS,
    );
  });

  it("덮어쓰지 않는다는 것을 화면이 말한다", async () => {
    /*
     * 이 문구가 없으면 다음 사람이 '시트가 정본인가' 를 물을 곳이 없고, 그 질문에
     * 잘못 답하면 앱 편집을 시트로 되돌리는 버튼을 다시 만든다.
     */
    render(<ImportLedgerYear academicYear={2026} />);
    fireEvent.click(screen.getByRole("button", { name: /적재/ }));

    expect(await screen.findByText(/덮어쓰지 않습니다/)).toBeTruthy();
  });
});
