import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { promoteSpy, refreshSpy, pushSpy, result } = vi.hoisted(() => ({
  promoteSpy: vi.fn(),
  refreshSpy: vi.fn(),
  pushSpy: vi.fn(),
  result: {
    value: { ok: true, toPath: "규칙/취업규칙 요점.md" } as unknown,
  },
}));

vi.mock("@/features/knowledge/actions", () => ({
  promoteProposalDoc: (...a: unknown[]) => {
    promoteSpy(...a);
    return Promise.resolve(result.value);
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshSpy, push: pushSpy }),
}));

const { ProposalPromote } = await import("../ProposalPromote");

const render1 = (category = "규칙") =>
  render(
    <ProposalPromote
      path="제안/취업규칙 요점.md"
      title="취업규칙 요점"
      category={category}
    />,
  );

/**
 * 검토하러 온 자리에서 바로 옮긴다. 지금까지는 채팅에서만 됐다.
 */
describe("ProposalPromote", () => {
  beforeEach(() => {
    promoteSpy.mockClear();
    refreshSpy.mockClear();
    pushSpy.mockClear();
    result.value = { ok: true, toPath: "규칙/취업규칙 요점.md" };
  });

  it("버튼 옆에 목적지를 늘어놓지 않는다 — 삭제 버튼의 라벨처럼 보인다", () => {
    // 확인 단계가 어디로 가는지 그대로 보여주므로 앞에서 또 말할 이유가 없다.
    render1();
    expect(screen.getByRole("button", { name: /지식망 옮기기/ })).toBeInTheDocument();
    expect(screen.queryByText(/규칙\//)).not.toBeInTheDocument();
  });

  it("확인 단계에서 어디로 가는지 보여준다", () => {
    render1();
    fireEvent.click(screen.getByRole("button", { name: /지식망 옮기기/ }));
    expect(screen.getByText(/규칙\//)).toBeInTheDocument();
  });

  it("표준 모달로 한 번 더 묻는다 — 본 위치는 여럿이 함께 쓰는 파일이다", () => {
    render1();
    fireEvent.click(screen.getByRole("button", { name: /지식망 옮기기/ }));
    expect(promoteSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "옮기기" })).toBeInTheDocument();
  });

  it("Esc 로 닫는다 — 표준 모달이 주는 동작을 그대로 쓴다", () => {
    render1();
    fireEvent.click(screen.getByRole("button", { name: /지식망 옮기기/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(promoteSpy).not.toHaveBeenCalled();
  });

  it("확인하면 옮긴다", async () => {
    render1();
    fireEvent.click(screen.getByRole("button", { name: /지식망 옮기기/ }));
    fireEvent.click(screen.getByRole("button", { name: "옮기기" }));
    await waitFor(() =>
      expect(promoteSpy).toHaveBeenCalledWith("제안/취업규칙 요점.md"),
    );
  });

  it("옮긴 뒤 새 자리로 보낸다 — 지금 보던 경로는 이제 없다", async () => {
    render1();
    fireEvent.click(screen.getByRole("button", { name: /지식망 옮기기/ }));
    fireEvent.click(screen.getByRole("button", { name: "옮기기" }));
    await waitFor(() =>
      expect(pushSpy).toHaveBeenCalledWith(
        `/dashboard/knowledge?doc=${encodeURIComponent("규칙/취업규칙 요점.md")}`,
      ),
    );
  });

  it("실패하면 사유를 보여주고 화면에 머문다", async () => {
    result.value = {
      ok: false,
      error: "규칙/ 에 같은 이름 문서가 이미 있습니다.",
    };
    render1();
    fireEvent.click(screen.getByRole("button", { name: /지식망 옮기기/ }));
    fireEvent.click(screen.getByRole("button", { name: "옮기기" }));
    await waitFor(() =>
      expect(screen.getByText(/같은 이름 문서가 이미/)).toBeInTheDocument(),
    );
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("취소하면 아무 일도 없다", () => {
    render1();
    fireEvent.click(screen.getByRole("button", { name: /지식망 옮기기/ }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(promoteSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /지식망 옮기기/ })).toBeInTheDocument();
  });

  /**
   * 초안의 분류가 볼트에 없는 값이면 옮길 자리가 없다. 눌러서 실패를 보느니
   * 무엇을 고쳐야 하는지 먼저 말한다.
   */
  it("분류를 모르면 버튼 대신 무엇을 고칠지 말한다", () => {
    render1("제안");
    expect(
      screen.queryByRole("button", { name: /지식망 옮기기/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/분류/)).toBeInTheDocument();
  });
});
