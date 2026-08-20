import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const sent: unknown[] = [];
const result = { ok: true as boolean, error: "" };
vi.mock("@/features/petty-cash/actions", () => ({
  appendSpend: (input: unknown) => {
    sent.push(input);
    return Promise.resolve(
      result.ok ? { ok: true } : { ok: false, error: result.error },
    );
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/components/common/ModalShell", () => ({
  ModalShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const { SpendForm } = await import("../SpendForm");

/**
 * 전도금 사용내역 직접 추가.
 *
 * 우편물은 영수증 판독으로 자동 기록되지만, **사무용품처럼 전도금으로 사는 다른
 * 것들**은 넣을 길이 없었다(2026-08-20). 엑셀을 직접 열지 않고 넣게 한다.
 */
describe("SpendForm", () => {
  beforeEach(() => {
    sent.length = 0;
    result.ok = true;
    result.error = "";
  });

  it("입력한 대로 장부에 넘긴다", async () => {
    render(<SpendForm onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("날짜"), {
      target: { value: "2026-08-20" },
    });
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "사무용품" },
    });
    fireEvent.change(screen.getByLabelText("건수"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("금액"), {
      target: { value: "12000" },
    });
    fireEvent.change(screen.getByLabelText("품목"), {
      target: { value: "A4용지" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      date: "2026-08-20",
      title: "사무용품",
      count: 2,
      amount: 12000,
      item: "A4용지",
    });
  });

  it("금액이 없으면 보내지 않는다 — 0원짜리 줄이 장부에 남으면 안 된다", async () => {
    render(<SpendForm onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("내용"), {
      target: { value: "사무용품" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(sent).toHaveLength(0);
    expect(screen.getByText("금액을 적어주세요")).toBeInTheDocument();
  });

  it("내용이 비면 보내지 않는다 — 무엇에 썼는지 없으면 장부가 아니다", async () => {
    render(<SpendForm onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("금액"), {
      target: { value: "1000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(sent).toHaveLength(0);
  });

  it("실패하면 이유를 그대로 보여주고 창을 닫지 않는다", async () => {
    const onClose = vi.fn();
    result.ok = false;
    result.error = "같은 날짜·금액·건수가 이미 장부에 있습니다";
    render(<SpendForm onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("내용"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("금액"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(screen.getByText(/이미 장부에 있습니다/)).toBeInTheDocument(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
