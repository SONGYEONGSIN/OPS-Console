import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandoverHistoryControls } from "../HandoverHistoryControls";

const push = vi.fn();
let mockParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/handover",
  useSearchParams: () => mockParams,
}));

describe("HandoverHistoryControls", () => {
  beforeEach(() => {
    push.mockReset();
    mockParams = new URLSearchParams("tab=history");
  });

  it("검색 input + 진행상태 select 렌더", () => {
    render(<HandoverHistoryControls />);
    expect(screen.getByLabelText("인수인계 확인 검색")).toBeInTheDocument();
    expect(screen.getByLabelText("진행상태 필터")).toBeInTheDocument();
  });

  it("진행상태 select 4개 옵션 (전체/진행중/완료/취소)", () => {
    render(<HandoverHistoryControls />);
    const select = screen.getByLabelText("진행상태 필터") as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(["", "in_progress", "completed", "cancelled"]);
  });

  it("status 변경 시 router.push + page 제거 + tab 유지", () => {
    mockParams = new URLSearchParams("tab=history&page=3");
    render(<HandoverHistoryControls />);
    fireEvent.change(screen.getByLabelText("진행상태 필터"), {
      target: { value: "completed" },
    });
    expect(push).toHaveBeenCalledWith(
      "/dashboard/handover?tab=history&status=completed",
    );
  });
});
