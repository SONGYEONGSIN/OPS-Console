import { describe, it, expect, vi, beforeEach } from "vitest";
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

describe("DeleteVideoButton", () => {
  it("처음엔 '삭제' 버튼만 표시 (확인 버튼 없음)", () => {
    render(<DeleteVideoButton id={ID} />);
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /삭제 확인/ }),
    ).not.toBeInTheDocument();
  });

  it("'삭제' 클릭 시 확인/취소 2단계로 전환", () => {
    render(<DeleteVideoButton id={ID} />);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(
      screen.getByRole("button", { name: /삭제 확인/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
  });

  it("'취소' 클릭 시 다시 '삭제' 버튼으로 복귀", () => {
    render(<DeleteVideoButton id={ID} />);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  it("'삭제 확인' 클릭 → 액션 호출 + 성공 시 onDeleted 콜백", async () => {
    (deleteInsightVideo as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      row: { id: ID, title: "t" },
    });
    const onDeleted = vi.fn();
    render(<DeleteVideoButton id={ID} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    fireEvent.click(screen.getByRole("button", { name: /삭제 확인/ }));

    await waitFor(() => {
      expect(deleteInsightVideo).toHaveBeenCalledWith(ID);
    });
    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledTimes(1);
    });
  });

  it("실패 시 에러 메시지 표시 + onDeleted 미호출", async () => {
    (deleteInsightVideo as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: "권한 없음",
    });
    const onDeleted = vi.fn();
    render(<DeleteVideoButton id={ID} onDeleted={onDeleted} />);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    fireEvent.click(screen.getByRole("button", { name: /삭제 확인/ }));

    expect(await screen.findByText("권한 없음")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
