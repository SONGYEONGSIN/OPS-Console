import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * 제안 결정 버튼 — **반려가 기본 선택지다**(설계 R4).
 *
 * 그래서 비대칭이다: 반려는 원장을 안 건드려 되돌릴 것이 없고, 적용은 원장을 바꾼다.
 * 한 번 더 묻는 쪽은 적용이다.
 */
const applyProposalBatch = vi.fn();
const rejectProposalBatch = vi.fn();

vi.mock("@/features/assignments/proposal/actions", () => ({
  applyProposalBatch: (...a: unknown[]) => applyProposalBatch(...a),
  rejectProposalBatch: (...a: unknown[]) => rejectProposalBatch(...a),
}));

const { ProposalDecision } = await import("../ProposalDecision");

beforeEach(() => {
  vi.clearAllMocks();
  applyProposalBatch.mockResolvedValue({
    ok: true,
    applied: 2,
    conflicted: 0,
    alreadyDone: 0,
  });
  rejectProposalBatch.mockResolvedValue({ ok: true });
});

describe("ProposalDecision", () => {
  it("적용은 한 번 더 묻는다 — 원장을 바꾸는 쪽이다", async () => {
    render(<ProposalDecision batchId="b1" />);
    fireEvent.click(screen.getByRole("button", { name: /전체 적용/ }));
    expect(applyProposalBatch).not.toHaveBeenCalled();
    expect(screen.getByText(/원장을 바꿉니다/)).toBeInTheDocument();
  });

  it("확인하면 적용하고 결과를 적는다", async () => {
    render(<ProposalDecision batchId="b1" />);
    fireEvent.click(screen.getByRole("button", { name: /전체 적용/ }));
    fireEvent.click(screen.getByRole("button", { name: /예, 적용/ }));
    expect(applyProposalBatch).toHaveBeenCalledWith("b1");
    expect(await screen.findByText(/적용 2건/)).toBeInTheDocument();
  });

  it("경합 건수를 함께 적는다 — 몇 줄이 안 들어갔는지가 조치다", async () => {
    applyProposalBatch.mockResolvedValue({
      ok: true,
      applied: 1,
      conflicted: 2,
      alreadyDone: 0,
    });
    render(<ProposalDecision batchId="b1" />);
    fireEvent.click(screen.getByRole("button", { name: /전체 적용/ }));
    fireEvent.click(screen.getByRole("button", { name: /예, 적용/ }));
    expect(await screen.findByText(/그 사이 바뀜 2건/)).toBeInTheDocument();
  });

  it("반려는 바로 하고 원장이 그대로임을 알린다", async () => {
    render(<ProposalDecision batchId="b1" />);
    fireEvent.click(screen.getByRole("button", { name: /반려/ }));
    expect(rejectProposalBatch).toHaveBeenCalledWith("b1");
    expect(await screen.findByText(/원장은 그대로/)).toBeInTheDocument();
  });

  it("실패 사유를 요약하지 않고 그대로 보여준다", async () => {
    applyProposalBatch.mockResolvedValue({
      ok: false,
      error: "연결 안 됨 — 운영자 명부에 없는 주소입니다: z@x.com",
    });
    render(<ProposalDecision batchId="b1" />);
    fireEvent.click(screen.getByRole("button", { name: /전체 적용/ }));
    fireEvent.click(screen.getByRole("button", { name: /예, 적용/ }));
    expect(await screen.findByText(/명부에 없는 주소/)).toBeInTheDocument();
  });

  it("행별 적용 버튼을 두지 않는다 — 한 줄만 적용하면 하위유형이 갈린다", () => {
    // 원장은 하위유형마다 한 줄이라, 한 줄만 적용하면 수시는 김·정시는 이가 된다.
    // 그게 G4 가 막으려던 분할이다(rev 4).
    render(<ProposalDecision batchId="b1" />);
    expect(screen.queryByRole("button", { name: /행별/ })).toBeNull();
  });
});
