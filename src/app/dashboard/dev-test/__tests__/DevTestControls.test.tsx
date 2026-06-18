import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
const search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/dev-test",
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/features/entertest/actions", () => ({
  setMyEntertestAccount: vi.fn(),
}));

import { DevTestControls } from "../DevTestControls";

const opts = {
  categoryOptions: ["수시", "정시"],
  regionOptions: ["서울"],
  universityTypeOptions: [],
  admissionTypeOptions: [],
};

describe("DevTestControls", () => {
  it("계정 미등록 시 안내 + 등록 버튼, 검색/필터 노출", () => {
    render(<DevTestControls myAccount={null} {...opts} />);
    expect(screen.getByText(/등록되지 않았습니다/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "등록" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/검색/)).toBeInTheDocument();
  });

  it("계정 등록 시 등록 계정 표시 + 수정 버튼", () => {
    render(<DevTestControls myAccount="jt29001" {...opts} />);
    expect(screen.getByText(/jt29001/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "수정" })).toBeInTheDocument();
  });

  it("카테고리 선택 시 searchParam으로 이동", () => {
    render(<DevTestControls myAccount={null} {...opts} />);
    fireEvent.change(screen.getByLabelText("카테고리 필터"), {
      target: { value: "수시" },
    });
    expect(push).toHaveBeenCalled();
    expect(push.mock.calls[0][0]).toContain("category=");
  });
});
