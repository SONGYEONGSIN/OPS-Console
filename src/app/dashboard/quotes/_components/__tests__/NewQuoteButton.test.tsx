import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { mockCreate, mockPush } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock("@/features/quotes/document-actions", () => ({
  createQuoteWithType: mockCreate,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { NewQuoteButton } from "../NewQuoteButton";

beforeEach(() => vi.clearAllMocks());

describe("NewQuoteButton", () => {
  it("버튼 클릭 시 견적서 유형 선택 모달을 연다", () => {
    render(<NewQuoteButton />);
    expect(screen.queryByText("견적서 유형 선택")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /새 견적서/ }));
    expect(screen.getByText("견적서 유형 선택")).toBeInTheDocument();
    // 유형 버튼 표시 (시스템 개발비 등)
    expect(
      screen.getByRole("button", { name: "시스템 개발비" }),
    ).toBeInTheDocument();
  });

  it("유형 선택 시 createQuoteWithType 호출 후 편집 화면으로 이동한다", async () => {
    mockCreate.mockResolvedValue({ ok: true, id: "q-1" });
    render(<NewQuoteButton />);
    fireEvent.click(screen.getByRole("button", { name: /새 견적서/ }));
    fireEvent.click(screen.getByRole("button", { name: "시스템 개발비" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith("dev"));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/dashboard/quotes/q-1"),
    );
  });

  it("생성 실패 시 이동하지 않고 모달을 닫는다", async () => {
    mockCreate.mockResolvedValue({ ok: false, error: "실패" });
    render(<NewQuoteButton />);
    fireEvent.click(screen.getByRole("button", { name: /새 견적서/ }));
    fireEvent.click(screen.getByRole("button", { name: "시스템 개발비" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByText("견적서 유형 선택")).not.toBeInTheDocument(),
    );
  });
});
