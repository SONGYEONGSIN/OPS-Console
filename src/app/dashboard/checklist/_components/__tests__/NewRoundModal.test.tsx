import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NewRoundModal } from "../NewRoundModal";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/features/checklist/actions", () => ({
  createRoundAction: vi.fn(async () => ({ ok: true, id: "round-1" })),
}));

const rounds = [{ id: "round-1", title: "2026학년도 정시모집" }];

describe("NewRoundModal", () => {
  it("렌더 — 제목 input + 시작 방식 라디오 3개 + 복제 회차 select", () => {
    render(<NewRoundModal rounds={rounds} onClose={() => {}} />);
    expect(screen.getByText("새 회차 생성")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/수시모집/)).toBeInTheDocument();
    expect(screen.getByLabelText("기본 템플릿")).toBeInTheDocument();
    expect(screen.getByLabelText("이전 회차 복제")).toBeInTheDocument();
    expect(screen.getByLabelText("빈 회차")).toBeInTheDocument();
    expect(screen.getByText("2026학년도 정시모집")).toBeInTheDocument();
  });

  it("기본 템플릿 라디오가 기본 선택", () => {
    render(<NewRoundModal rounds={rounds} onClose={() => {}} />);
    const radio = screen.getByLabelText("기본 템플릿") as HTMLInputElement;
    expect(radio.checked).toBe(true);
  });

  it("취소 클릭 → onClose 호출", () => {
    const onClose = vi.fn();
    render(<NewRoundModal rounds={rounds} onClose={onClose} />);
    fireEvent.click(screen.getByText("취소"));
    expect(onClose).toHaveBeenCalled();
  });
});
