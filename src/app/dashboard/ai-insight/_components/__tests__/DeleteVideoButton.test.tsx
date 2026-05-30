import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/features/insight-videos/actions", () => ({
  deleteInsightVideo: vi.fn(),
}));

import { DeleteVideoButton } from "../DeleteVideoButton";
import { deleteInsightVideo } from "@/features/insight-videos/actions";

const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DeleteVideoButton", () => {
  it("'삭제' 버튼을 렌더 (인라인 확인 단계 없음)", () => {
    render(<DeleteVideoButton id={ID} />);
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "취소" }),
    ).not.toBeInTheDocument();
  });

  it("confirm 취소 시 액션 미호출 + onDeleted 미호출", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const onDeleted = vi.fn();
    render(<DeleteVideoButton id={ID} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(deleteInsightVideo).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("confirm 확인 시 즉시 삭제 + 성공하면 onDeleted 호출", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    (deleteInsightVideo as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      row: { id: ID, title: "t" },
    });
    const onDeleted = vi.fn();
    render(<DeleteVideoButton id={ID} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => {
      expect(deleteInsightVideo).toHaveBeenCalledWith(ID);
    });
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledTimes(1);
    });
  });

  it("confirm 확인 후 실패 시 에러 메시지 표시 + onDeleted 미호출", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    (deleteInsightVideo as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: "권한 없음",
    });
    const onDeleted = vi.fn();
    render(<DeleteVideoButton id={ID} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(await screen.findByText("권한 없음")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
