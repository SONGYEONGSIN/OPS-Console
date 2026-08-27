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

  it("어디로 가는지 먼저 보여준다 — 누르고 나서 알면 늦다", () => {
    render1();
    expect(screen.getByRole("button", { name: /지식망 옮기기/ })).toBeInTheDocument();
    expect(screen.getByText(/규칙\//)).toBeInTheDocument();
  });

  it("한 번 더 묻는다 — 본 위치는 여럿이 함께 쓰는 파일이다", () => {
    render1();
    fireEvent.click(screen.getByRole("button", { name: /지식망 옮기기/ }));
    expect(promoteSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "옮기기" })).toBeInTheDocument();
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
