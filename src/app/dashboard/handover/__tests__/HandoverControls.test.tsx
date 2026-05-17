import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandoverControls } from "../HandoverControls";

const push = vi.fn();
let mockParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/handover",
  useSearchParams: () => mockParams,
}));

describe("HandoverControls", () => {
  beforeEach(() => {
    push.mockReset();
    mockParams = new URLSearchParams();
  });

  it("검색 input + 작성상태 select 렌더", () => {
    render(<HandoverControls />);
    expect(screen.getByLabelText("인수인계 검색")).toBeInTheDocument();
    expect(screen.getByLabelText("작성상태 필터")).toBeInTheDocument();
  });

  it("작성상태 select 5개 옵션 (전체/미작성/작성중/작성완료/인계완료)", () => {
    render(<HandoverControls />);
    const select = screen.getByLabelText("작성상태 필터") as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(["", "none", "draft", "ready", "published"]);
  });

  it("status select 변경 시 router.push 호출 + page 파라미터 제거", () => {
    mockParams = new URLSearchParams("page=3");
    render(<HandoverControls />);
    fireEvent.change(screen.getByLabelText("작성상태 필터"), {
      target: { value: "ready" },
    });
    expect(push).toHaveBeenCalledWith("/dashboard/handover?status=ready");
  });
});
