import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HEADER_ACTION_CLASS } from "@/components/common/HeaderActionButton";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
const submitReport = vi.fn();
vi.mock("@/features/ops-weekly/workflow-actions", () => ({
  submitReport: (...a: unknown[]) => submitReport(...a),
}));

import { SubmitBar } from "../_components/SubmitBar";

const tokens = (el: Element) => el.className.split(/\s+/);

beforeEach(() => {
  refresh.mockReset();
  submitReport.mockReset();
});

describe("SubmitBar", () => {
  it("제출 버튼은 canSubmit 일 때만, 표준 헤더 액션 모양", () => {
    const { rerender } = render(<SubmitBar reportId="r1" canSubmit />);
    expect(
      screen.getByRole("button", { name: "제출완료" }).className,
    ).toContain(HEADER_ACTION_CLASS);
    rerender(<SubmitBar reportId="r1" canSubmit={false} />);
    expect(screen.queryByRole("button", { name: "제출완료" })).toBeNull();
  });

  it("확인 조건이 없다 — canSubmit 이면 바로 눌리고 '남은 확인' 문구도 없다", () => {
    render(<SubmitBar reportId="r1" canSubmit />);
    expect(screen.getByRole("button", { name: "제출완료" })).toBeEnabled();
    expect(screen.queryByText(/남은 확인/)).toBeNull();
  });

  it("제출 성공 → 새로고침", async () => {
    submitReport.mockResolvedValue({ ok: true });
    render(<SubmitBar reportId="r1" canSubmit />);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(submitReport).toHaveBeenCalledWith({ reportId: "r1" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("제출은 끝났지만 후속 실패 → 새로고침하고 그 문구를 실패로 포장하지 않는다", async () => {
    submitReport.mockResolvedValue({
      ok: false,
      error: "제출은 끝났지만 전원 제출 확인에 실패했습니다: x",
    });
    render(<SubmitBar reportId="r1" canSubmit />);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(
      screen.getByText("제출은 끝났지만 전원 제출 확인에 실패했습니다: x"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/제출에 실패/)).toBeNull();
  });

  it("제출 뒤 canSubmit 이 false 로 와도 '제출은 끝났지만' 안내가 남는다", async () => {
    const msg = "제출은 끝났지만 전원 제출 확인에 실패했습니다: x";
    submitReport.mockResolvedValue({ ok: false, error: msg });
    const { rerender } = render(<SubmitBar reportId="r1" canSubmit />);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    rerender(<SubmitBar reportId="r1" canSubmit={false} />);
    expect(screen.queryByRole("button", { name: "제출완료" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(msg);
  });

  it("보일 것이 없으면(제출 불가·대기 없음·안내 없음) 아무것도 그리지 않는다", () => {
    const { container } = render(<SubmitBar reportId="r1" canSubmit={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("안내가 남은 동안은 묶음이 남고 안내는 text-ink-soft", async () => {
    submitReport.mockResolvedValue({
      ok: false,
      error: "제출은 끝났지만 전원 제출 확인에 실패했습니다: x",
    });
    const { container, rerender } = render(
      <SubmitBar reportId="r1" canSubmit />,
    );
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    rerender(<SubmitBar reportId="r1" canSubmit={false} />);
    expect(container).not.toBeEmptyDOMElement();
    expect(tokens(screen.getByRole("status"))).toContain("text-ink-soft");
  });

  it("진짜 제출 실패도 새로고침해 낡은 화면을 바로잡는다", async () => {
    submitReport.mockResolvedValue({
      ok: false,
      error: "이미 제출한 보고서입니다.",
    });
    render(<SubmitBar reportId="r1" canSubmit />);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "이미 제출한 보고서입니다.",
    );
  });

  it("제출 action 이 던져도 페이지를 날리지 않고 안내 + 새로고침", async () => {
    submitReport.mockRejectedValue(new Error("명단 조회 실패"));
    render(<SubmitBar reportId="r1" canSubmit />);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "제출하지 못했습니다 — 잠시 후 다시 시도하세요",
    );
    expect(screen.queryByText(/명단 조회 실패/)).toBeNull();
  });

  it("제출 실패 메시지는 버튼 뒤 줄에서 vermilion 으로", async () => {
    submitReport.mockResolvedValue({ ok: false, error: "이미 제출함" });
    render(<SubmitBar reportId="r1" canSubmit />);
    const button = screen.getByRole("button", { name: "제출완료" });
    fireEvent.click(button);
    const alert = await screen.findByRole("alert");
    expect(tokens(alert)).toContain("text-vermilion");
    expect(
      button.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
