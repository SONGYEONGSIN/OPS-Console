import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/feedback",
}));

const fixture = [
  {
    title: "운영부",
    label: "운영부",
    entries: [
      {
        kind: "group" as const,
        ico: "▸",
        label: "운영부",
        count: "2",
        defaultOpen: true,
        items: [
          { kind: "item" as const, ico: "·", label: "개선요청", slug: "feedback" },
          { kind: "item" as const, ico: "·", label: "공지사항", slug: "notices" },
        ],
      },
    ],
  },
];

describe("Sidebar — active sub-item bar", () => {
  it("active sub-item에 좌측 vermilion bar 노출 (mockup folio-dashboard 매칭)", () => {
    render(<Sidebar sections={fixture} open={true} onClose={() => {}} />);
    const active = screen.getByRole("link", { name: /개선요청/ });
    const bar = active.querySelector("span[aria-hidden]");
    expect(bar).toBeTruthy();
    expect(bar?.className).toMatch(/bg-vermilion/);
  });

  it("inactive sub-item에는 vermilion bar 미노출", () => {
    render(<Sidebar sections={fixture} open={true} onClose={() => {}} />);
    const inactive = screen.getByRole("link", { name: /공지사항/ });
    expect(inactive.querySelector("span[aria-hidden]")).toBeNull();
  });
});

/**
 * 모바일 서랍은 **메뉴를 누르면 닫혀야** 한다. 지금은 onClose 가 × 버튼에만
 * 걸려 있어, 항목을 눌러 이동해도 서랍이 새 화면 위에 그대로 남았다
 * (2026-08-25 실사용 제보).
 *
 * × 는 남기되 조용하게 둔다 — 테두리 있는 흰 박스라 사이드바(웜 화이트) 위에
 * 덧댄 것처럼 떴다.
 */
describe("Sidebar — 모바일 서랍 닫기", () => {
  it("메뉴 항목을 누르면 닫힌다", () => {
    const onClose = vi.fn();
    render(<Sidebar sections={fixture} open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("공지사항"));
    expect(onClose).toHaveBeenCalled();
  });

  it("하위 항목도 마찬가지다", () => {
    const onClose = vi.fn();
    render(<Sidebar sections={fixture} open={true} onClose={onClose} />);
    fireEvent.click(screen.getByText("개선요청"));
    expect(onClose).toHaveBeenCalled();
  });

  it("닫기 버튼에 테두리·배경을 두지 않는다 — 덧댄 상자처럼 보였다", () => {
    render(<Sidebar sections={fixture} open={true} onClose={vi.fn()} />);
    const btn = screen.getByLabelText("메뉴 닫기");
    expect(btn.className).not.toContain("border-line");
    expect(btn.className).not.toContain("bg-paper");
  });

  it("닫기 버튼이 자기 자리를 갖는다 — 띄우면 아래 내용 위에 얹힌다", () => {
    // absolute 로 뒀더니 첫 섹션 헤더의 구분선과 겹쳤다(2026-08-25).
    render(<Sidebar sections={fixture} open={true} onClose={vi.fn()} />);
    const btn = screen.getByLabelText("메뉴 닫기");
    expect(btn.className).not.toContain("absolute");
    const row = btn.parentElement;
    expect(row?.className).toContain("max-lg:flex");
    expect(row?.className).toContain("justify-end");
  });
});
