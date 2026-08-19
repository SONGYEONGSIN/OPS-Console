import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PettyCashPanel } from "../PettyCashPanel";
import type { PettyCashSheet } from "@/features/petty-cash/parse";

vi.mock("@/features/petty-cash/actions", () => ({ appendSpend: vi.fn() }));

const SHEET: PettyCashSheet = {
  balance: 491660,
  totalSpent: 1162560,
  entries: [
    { kind: "refill", before: 348980, balance: 500000 },
    { kind: "spend", date: "2026-08-19", title: "우편물", count: 2, amount: 8340, item: null, balance: 491660 },
    { kind: "spend", date: "2026-08-18", title: "우편물", count: 3, amount: 13290, item: null, balance: 151020 },
  ],
};

describe("PettyCashPanel", () => {
  it("현재 잔액을 크게 보여준다 — 이 화면에서 가장 먼저 볼 값이다", () => {
    render(<PettyCashPanel sheet={SHEET} />);
    // 같은 금액이 표의 잔액 열에도 나오므로 헤더 쪽만 겨냥한다
    const heading = screen.getByText("현재 잔액").parentElement;
    expect(heading?.textContent).toContain("491,660원");
  });

  it("올해 쓴 총액도 보여준다", () => {
    render(<PettyCashPanel sheet={SHEET} />);
    expect(screen.getByText(/1,162,560/)).toBeInTheDocument();
  });

  it("사용 내역을 표로 보여준다", () => {
    render(<PettyCashPanel sheet={SHEET} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("2026-08-19")).toBeInTheDocument();
  });

  it("청구 행은 채운 것으로 표시한다 — 사용과 섞이면 잔액이 튀어 보인다", () => {
    render(<PettyCashPanel sheet={SHEET} />);
    expect(screen.getByText(/전도금 청구/)).toBeInTheDocument();
  });

  it("장부를 못 읽으면 그렇다고 말한다 — 빈 표로 두면 0원인 줄 안다", () => {
    render(<PettyCashPanel sheet={null} />);
    expect(screen.getByText(/읽지 못했습니다/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("잔액이 적으면 눈에 띄게 한다 — 채워야 할 때를 놓치면 발송이 막힌다", () => {
    render(<PettyCashPanel sheet={{ ...SHEET, balance: 40000 }} />);
    // 카드 안에 안내가 붙고 값이 vermilion으로 바뀐다
    expect(screen.getByText(/청구를 준비하세요/)).toBeInTheDocument();
    expect(screen.getByText("40,000원").className).toContain("text-vermilion");
  });
});

describe("PettyCashPanel — 카드·제목·검색", () => {
  it("현황을 카드로 보여준다 — 운영리포트처럼 숫자를 먼저 본다", () => {
    render(<PettyCashPanel sheet={SHEET} />);
    ["현재 잔액", "올해 사용", "사용 건수", "마지막 청구"].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument(),
    );
  });

  it("사용 건수는 청구를 빼고 센다", () => {
    render(<PettyCashPanel sheet={SHEET} />);
    // SHEET에는 사용 2건 + 청구 1건
    const card = screen.getByText("사용 건수").parentElement;
    expect(card?.textContent).toContain("2");
  });

  it("표에 제목이 있다 — 무슨 목록인지 알 수 없었다", () => {
    render(<PettyCashPanel sheet={SHEET} />);
    expect(
      screen.getByRole("heading", { name: "사용 내역" }),
    ).toBeInTheDocument();
  });

  it("검색으로 거른다", () => {
    render(<PettyCashPanel sheet={SHEET} />);
    fireEvent.change(screen.getByLabelText("전도금 검색"), {
      target: { value: "08-18" },
    });
    expect(screen.getByText("2026-08-18")).toBeInTheDocument();
    expect(screen.queryByText("2026-08-19")).toBeNull();
  });

  it("검색하면 청구 행도 함께 걸러진다 — 관련 없는 줄이 남으면 헷갈린다", () => {
    render(<PettyCashPanel sheet={SHEET} />);
    fireEvent.change(screen.getByLabelText("전도금 검색"), {
      target: { value: "08-18" },
    });
    expect(screen.queryByText(/전도금 청구/)).toBeNull();
  });

  it("검색 결과가 없으면 그렇다고 말한다", () => {
    render(<PettyCashPanel sheet={SHEET} />);
    fireEvent.change(screen.getByLabelText("전도금 검색"), {
      target: { value: "없는것" },
    });
    expect(screen.getByText(/찾는 내역이 없습니다/)).toBeInTheDocument();
  });
});
