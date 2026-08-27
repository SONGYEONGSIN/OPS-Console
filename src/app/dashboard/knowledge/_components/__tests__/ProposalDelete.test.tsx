import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const deleteMock = vi.fn();
vi.mock("@/features/knowledge/actions", () => ({
  deleteProposalDoc: (p: string) => deleteMock(p),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { ProposalDelete } = await import("../ProposalDelete");

/**
 * 제안 초안만 화면에서 지운다. 되돌릴 수 없으므로 **한 번 더 묻는다** —
 * 파일명을 보여주고 확인해야 실제로 지운다.
 */
describe("ProposalDelete", () => {
  beforeEach(() => {
    deleteMock.mockReset();
    deleteMock.mockResolvedValue({ ok: true });
  });

  it("처음에는 삭제 버튼만 보인다", () => {
    render(<ProposalDelete path="제안/x.md" title="부산대 세팅" />);
    expect(screen.getByRole("button", { name: "초안 삭제" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "삭제" })).toBeNull();
  });

  it("표준 모달로 묻는다 — 옮기기와 확인 방식이 다르면 어색하다", () => {
    render(<ProposalDelete path="제안/x.md" title="x" />);
    fireEvent.click(screen.getByRole("button", { name: "초안 삭제" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Esc 로 닫는다 — 표준 모달이 주는 동작을 그대로 쓴다", () => {
    render(<ProposalDelete path="제안/x.md" title="x" />);
    fireEvent.click(screen.getByRole("button", { name: "초안 삭제" }));
    // 떠 있는 걸 먼저 확인해야 이 테스트가 뭔가를 검증한다.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("누르면 파일명을 보여주고 되돌릴 수 없다고 알린다", () => {
    render(<ProposalDelete path="제안/x.md" title="부산대 세팅" />);
    fireEvent.click(screen.getByRole("button", { name: "초안 삭제" }));
    expect(screen.getByText(/제안\/x\.md/)).toBeInTheDocument();
    expect(screen.getByText(/되돌릴 수 없습니다/)).toBeInTheDocument();
  });

  it("확인해야 실제로 지운다", async () => {
    render(<ProposalDelete path="제안/x.md" title="부산대 세팅" />);
    fireEvent.click(screen.getByRole("button", { name: "초안 삭제" }));
    expect(deleteMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith("제안/x.md"));
  });

  it("취소하면 안 지운다", () => {
    render(<ProposalDelete path="제안/x.md" title="부산대 세팅" />);
    fireEvent.click(screen.getByRole("button", { name: "초안 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(deleteMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "초안 삭제" })).toBeInTheDocument();
  });

  it("실패하면 이유를 그대로 보여준다 — 조용히 넘기지 않는다", async () => {
    deleteMock.mockResolvedValue({ ok: false, error: "파일 삭제 실패 (500)" });
    render(<ProposalDelete path="제안/x.md" title="부산대 세팅" />);
    fireEvent.click(screen.getByRole("button", { name: "초안 삭제" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() =>
      expect(screen.getByText(/파일 삭제 실패 \(500\)/)).toBeInTheDocument(),
    );
  });
});
