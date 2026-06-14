import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { mockCreate, mockPush } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock("@/features/meetings/actions", () => ({
  createMeeting: mockCreate,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { NewMeetingButton } from "../NewMeetingButton";

beforeEach(() => vi.clearAllMocks());

describe("NewMeetingButton", () => {
  it("버튼 클릭 시 회의 유형 선택 모달을 연다", () => {
    render(<NewMeetingButton />);
    expect(screen.queryByText("회의 유형 선택")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /새 회의록/ }));
    expect(screen.getByText("회의 유형 선택")).toBeInTheDocument();
    // 5개 유형 버튼 표시
    expect(screen.getByRole("button", { name: "정기회의" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "긴급·이슈 대응" }),
    ).toBeInTheDocument();
  });

  it("유형 선택 시 createMeeting 호출 후 편집 화면으로 이동한다", async () => {
    mockCreate.mockResolvedValue({ ok: true, id: "meet-1" });
    render(<NewMeetingButton />);
    fireEvent.click(screen.getByRole("button", { name: /새 회의록/ }));
    fireEvent.click(screen.getByRole("button", { name: "정기회의" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith("regular"));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/dashboard/meetings/meet-1"),
    );
  });

  it("생성 실패 시 이동하지 않고 모달을 닫는다", async () => {
    mockCreate.mockResolvedValue({ ok: false, error: "실패" });
    render(<NewMeetingButton />);
    fireEvent.click(screen.getByRole("button", { name: /새 회의록/ }));
    fireEvent.click(screen.getByRole("button", { name: "정기회의" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText("회의 유형 선택")).not.toBeInTheDocument(),
    );
  });
});
