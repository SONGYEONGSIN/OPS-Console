import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const requestSingleProposal = vi.fn();
vi.mock("@/features/assignments/proposal/actions", () => ({
  requestSingleProposal: (...a: unknown[]) => requestSingleProposal(...a),
}));

import { RequestAssignment } from "../RequestAssignment";

/**
 * 단건 배정 요청 버튼 — **누른다고 배정되지 않는다.**
 *
 * 폴러가 판정하고 관리자가 제안 탭에서 다시 승인한다. 그 사이 화면에 아무 흔적이
 * 없으면 사람은 안 눌렸다고 판단하고 같은 버튼을 계속 누른다 — 큐에 같은 판정이
 * 쌓이는 것은 적재 쪽이 막지만, 막힌 사실 또한 보여야 한다.
 */
const props = {
  academicYear: 2027,
  universityName: "새대",
  workKind: "원서접수",
};

describe("RequestAssignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestSingleProposal.mockResolvedValue({
      ok: true,
      skipped: false,
      message: "회사 PC 폴러에 판정을 요청했습니다",
    });
  });

  it("대상 셋을 그대로 넘긴다", async () => {
    render(<RequestAssignment {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /배정 요청/ }));

    await waitFor(() =>
      expect(requestSingleProposal).toHaveBeenCalledWith({
        academicYear: 2027,
        universityName: "새대",
        workKind: "원서접수",
      }),
    );
  });

  it("결과를 그 자리에 적는다 — 흔적이 없으면 또 누른다", async () => {
    render(<RequestAssignment {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /배정 요청/ }));

    expect(await screen.findByText(/판정을 요청했습니다/)).toBeTruthy();
  });

  it("이미 대기 중인 것은 실패가 아니다 — 붉게 적지 않는다", async () => {
    requestSingleProposal.mockResolvedValue({
      ok: false,
      skipped: true,
      message: "이미 대기/진행 중인 판정 요청이 있습니다.",
    });

    render(<RequestAssignment {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /배정 요청/ }));

    const msg = await screen.findByText(/이미 대기/);
    expect(msg.className).not.toMatch(/vermilion/);
  });

  it("진짜 실패는 붉게 적는다", async () => {
    requestSingleProposal.mockResolvedValue({
      ok: false,
      skipped: false,
      message: "admin만 제안을 처리할 수 있습니다",
    });

    render(<RequestAssignment {...props} />);
    fireEvent.click(screen.getByRole("button", { name: /배정 요청/ }));

    const msg = await screen.findByText(/admin만/);
    expect(msg.className).toMatch(/vermilion/);
  });
});
