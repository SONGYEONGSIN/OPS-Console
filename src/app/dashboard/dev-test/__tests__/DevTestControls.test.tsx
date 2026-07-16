import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
const search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/dev-test",
  useSearchParams: () => new URLSearchParams(search),
}));

import { DevTestControls } from "../DevTestControls";

const opts = {
  categoryOptions: ["수시", "정시"],
  universityTypeOptions: [],
  admissionTypeOptions: [],
};

describe("DevTestControls", () => {
  it("검색 + 필터 셀렉트를 노출한다 (지역 필터는 없음)", () => {
    render(<DevTestControls {...opts} />);
    expect(screen.getByPlaceholderText(/검색/)).toBeInTheDocument();
    expect(screen.getByLabelText("카테고리 필터")).toBeInTheDocument();
    expect(screen.queryByLabelText("지역 필터")).toBeNull();
  });

  it("카테고리 선택 시 searchParam으로 이동", () => {
    render(<DevTestControls {...opts} />);
    fireEvent.change(screen.getByLabelText("카테고리 필터"), {
      target: { value: "수시" },
    });
    expect(push).toHaveBeenCalled();
    expect(push.mock.calls[0][0]).toContain("category=");
  });
});
