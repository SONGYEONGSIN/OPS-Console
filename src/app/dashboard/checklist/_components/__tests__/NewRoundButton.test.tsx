import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NewRoundButton } from "../NewRoundButton";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/features/checklist/actions", () => ({
  createRoundAction: vi.fn(),
}));

describe("NewRoundButton", () => {
  it("렌더 + 클릭 시 modal 노출", () => {
    render(<NewRoundButton rounds={[]} />);
    expect(screen.queryByText(/새 모집시기 생성/)).toBeNull();
    fireEvent.click(screen.getByText("+ 새 모집시기"));
    expect(screen.getByText(/새 모집시기 생성/)).toBeInTheDocument();
  });

  it("취소 클릭 → modal 닫힘", () => {
    render(<NewRoundButton rounds={[]} />);
    fireEvent.click(screen.getByText("+ 새 모집시기"));
    fireEvent.click(screen.getByText("취소"));
    expect(screen.queryByText(/새 모집시기 생성/)).toBeNull();
  });
});
