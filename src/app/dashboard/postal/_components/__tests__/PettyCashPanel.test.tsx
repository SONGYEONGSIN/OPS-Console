import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PettyCashPanel } from "../PettyCashPanel";
import type { PettyCashSheet } from "@/features/petty-cash/parse";

vi.mock("@/features/petty-cash/actions", () => ({ appendSpend: vi.fn() }));
// 사용내역 인스펙터가 라우터를 쓴다 — 열어보는 테스트라 필요하다.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));

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
    expect(screen.getByText(/전도금 청구를 준비하세요/)).toBeInTheDocument();
  });
});

describe("PettyCashPanel — 카드·제목·검색", () => {
  it("운영리포트 KpiCard를 그대로 쓴다 — 상단 카드의 표준이다", () => {
    const { container } = render(<PettyCashPanel sheet={SHEET} />);
    ["현재 잔액", "올해 사용", "사용 건수", "마지막 청구"].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument(),
    );
    // KpiCard 는 값을 text-2xl tabular-nums 로 그린다
    expect(container.querySelector(".text-2xl.tabular-nums")).not.toBeNull();
  });

  it("사용 건수는 청구를 빼고 센다", () => {
    render(<PettyCashPanel sheet={SHEET} />);
    // SHEET에는 사용 2건 + 청구 1건
    const card = screen.getByText("사용 건수").parentElement;
    expect(card?.textContent).toContain("2");
  });

  it("목록 제목은 표준 형태다 — '제목 · N건'", () => {
    render(<PettyCashPanel sheet={SHEET} />);
    const h = screen.getByRole("heading", { name: "사용 내역" });
    expect(h.className).toContain("text-xl");
    // 건수는 vermilion 으로 옆에 붙는다(ListPattern 헤더와 같은 모양)
    expect(h.parentElement?.textContent).toContain("2건");
  });

  it("검색은 제목과 떨어진 controlsRow 자리에 둔다 — 검색 앞에 제목을 붙이지 않는다", () => {
    render(<PettyCashPanel sheet={SHEET} />);
    const search = screen.getByLabelText("전도금 검색");
    const heading = screen.getByRole("heading", { name: "사용 내역" });
    // 같은 줄(부모)에 있으면 안 된다
    expect(heading.parentElement?.contains(search)).toBe(false);
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

describe("PettyCashPanel — 전도금대장 버튼", () => {
  it("사용내역 추가 왼쪽에 전도금대장이 있다", () => {
    render(<PettyCashPanel sheet={SHEET} pettyCashUrl="https://sp/petty.xlsx" />);
    const link = screen.getByRole("link", { name: "전도금대장" });
    expect(link).toHaveAttribute("href", "https://sp/petty.xlsx");
  });

  // 이 자리 버튼은 배경을 갖는 게 표준이다. 전도금대장만 아웃라인이라
  // 같은 '원본 엑셀 바로가기'가 등기내역 탭과 달라 보였다.
  it("배경색이 있다 — 등기대장 버튼과 같은 모양이어야 한다", () => {
    render(<PettyCashPanel sheet={SHEET} pettyCashUrl="https://sp/petty.xlsx" />);
    const link = screen.getByRole("link", { name: "전도금대장" });
    expect(link.className).toMatch(/bg-vermilion/);
  });

  it("링크가 없으면 버튼을 안 그린다 — 깨진 링크를 누르게 하지 않는다", () => {
    render(<PettyCashPanel sheet={SHEET} />);
    expect(screen.queryByRole("link", { name: "전도금대장" })).toBeNull();
  });
});

describe("PettyCashPanel — 인스펙터 겹침", () => {
  it("열면 본문을 오른쪽으로 비켜 놓는다 — 패널이 fixed라 그냥 두면 덮는다", () => {
    const { container } = render(<PettyCashPanel sheet={SHEET} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toMatch(/pr-\[340px\]/);

    fireEvent.click(screen.getByRole("button", { name: /사용내역 추가/ }));
    expect(root.className).toMatch(/pr-\[340px\]/);
  });
});

/**
 * 헤더 액션 버튼 크기.
 *
 * `ListPattern` 의 생성 버튼(`+ 백업 요청` 등)이 기준이고 `px-3 py-1 text-xs
 * font-medium` 이다. 전도금 탭 버튼만 한 치수 크게 만들어 다른 메뉴와 달라
 * 보였다(2026-08-20 지적). 등기관리 탭의 `등기대장` 은 이미 표준이었다.
 */
describe("PettyCashPanel — 버튼 크기", () => {
  it("두 버튼 모두 표준 치수다", () => {
    render(<PettyCashPanel sheet={SHEET} pettyCashUrl="https://sp/p.xlsx" />);
    for (const el of [
      screen.getByRole("link", { name: "전도금대장" }),
      screen.getByRole("button", { name: /사용내역 추가/ }),
    ]) {
      expect(el.className).toMatch(/px-3/);
      expect(el.className).toMatch(/py-1(?!\.)/);
      expect(el.className).toMatch(/text-xs/);
      expect(el.className).toMatch(/font-medium/);
    }
  });
});
