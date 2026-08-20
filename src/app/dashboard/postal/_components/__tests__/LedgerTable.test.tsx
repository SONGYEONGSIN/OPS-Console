import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LedgerTable } from "../LedgerTable";
import type { LedgerLine } from "@/features/postal/ledger";

vi.mock("@/components/common/ModalShell", () => ({
  ModalShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const line = (over: Partial<LedgerLine> = {}): LedgerLine => ({
  seq: 1,
  sentOn: "2026-08-18",
  recipientOrg: "우석대학교",
  recipientName: "강정화",
  assignee: "김지현",
  confirmedBy: "박수정",
  trackingNo: "11263-1102-7080",
  note: "",
  receiptId: "r1",
  ...over,
});

/**
 * 대장이 목록이고 영수증은 증빙이다.
 *
 * 지금까지는 반대로 영수증 목록이 표를 차지했다(2026-08-20 지적). 확인해야 할 것은
 * "영수증이 어디 있나"가 아니라 **"증빙 없는 행이 있나"** 라서, 대장에 붙여 둔다.
 */
describe("LedgerTable", () => {
  it("대장 행을 그린다", () => {
    render(<LedgerTable rows={[line()]} receiptUrls={{ r1: "https://s/a.jpg" }} />);
    expect(screen.getByText("우석대학교")).toBeInTheDocument();
    expect(screen.getByText("11263-1102-7080")).toBeInTheDocument();
    expect(screen.getByText("김지현")).toBeInTheDocument();
  });

  it("날짜별로 묶고 등기·영수증 수를 함께 보여준다", () => {
    render(
      <LedgerTable
        rows={[line(), line({ seq: 2, trackingNo: "…7081" })]}
        receiptUrls={{ r1: "https://s/a.jpg" }}
      />,
    );
    // 등기 2건인데 영수증은 1장 — 한 장에 여러 건이 찍히므로 정상이다
    expect(screen.getByText(/등기 2건/)).toBeInTheDocument();
    expect(screen.getByText(/영수증 1장/)).toBeInTheDocument();
  });

  it("증빙 없는 날은 드러낸다 — 이게 확인해야 할 신호다", () => {
    render(<LedgerTable rows={[line({ receiptId: null })]} receiptUrls={{}} />);
    expect(screen.getByText(/증빙 없음/)).toBeInTheDocument();
  });

  it("영수증이 있으면 눌러서 원본을 연다", () => {
    render(<LedgerTable rows={[line()]} receiptUrls={{ r1: "https://s/a.jpg" }} />);
    fireEvent.click(screen.getByRole("button", { name: /영수증/ }));
    expect(screen.getByRole("img", { name: /영수증/ })).toHaveAttribute(
      "src",
      "https://s/a.jpg",
    );
  });

  it("서명이 만료돼 URL이 없으면 버튼을 만들지 않는다 — 눌러도 안 열리면 고장으로 보인다", () => {
    render(<LedgerTable rows={[line()]} receiptUrls={{}} />);
    expect(screen.queryByRole("button", { name: /영수증/ })).toBeNull();
  });

  it("행이 없으면 무엇이 없는지 말한다", () => {
    render(<LedgerTable rows={[]} receiptUrls={{}} />);
    expect(screen.getByText(/대장에 기록된 발송이 없습니다/)).toBeInTheDocument();
  });
});
