import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorklogControls } from "../WorklogControls";

const push = vi.fn();
let mockParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/worklog",
  useSearchParams: () => mockParams,
}));

describe("WorklogControls", () => {
  beforeEach(() => {
    push.mockReset();
    mockParams = new URLSearchParams();
  });

  it("검색 + 도메인 + 레벨 select 렌더", () => {
    render(<WorklogControls />);
    expect(screen.getByLabelText("활동 검색")).toBeInTheDocument();
    expect(screen.getByLabelText("도메인 필터")).toBeInTheDocument();
    expect(screen.getByLabelText("레벨 필터")).toBeInTheDocument();
  });

  it("도메인 5종 + 전체", () => {
    render(<WorklogControls />);
    const select = screen.getByLabelText("도메인 필터") as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain("");
    expect(values).toContain("handover");
    expect(values).toContain("incidents");
    expect(values).toContain("services");
    expect(values).toContain("contacts");
    expect(values).toContain("contracts");
  });

  it("레벨 select 변경 시 router.push", () => {
    render(<WorklogControls />);
    fireEvent.change(screen.getByLabelText("레벨 필터"), {
      target: { value: "ERROR" },
    });
    expect(push).toHaveBeenCalledWith("/dashboard/worklog?level=ERROR");
  });
});
