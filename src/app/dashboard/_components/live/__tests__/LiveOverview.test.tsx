import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiveOverview } from "../LiveOverview";
import type { FeedItem } from "../feed";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/dashboard/live",
  useSearchParams: () => new URLSearchParams(""),
}));

function mockReducedMotion() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches: true, // KpiTile 자식이 사용 — 단순화를 위해 reduced-motion 가정
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      media: "",
      dispatchEvent: () => false,
    }),
  });
}

const tiles = [
  { variant: "services" as const, label: "서비스", count: 5, countSub: "오픈 예정", href: "/dashboard/services" },
  { variant: "incidents" as const, label: "사고", count: 0, countSub: "registered", href: "/dashboard/incidents" },
];

const items: FeedItem[] = [
  { id: "i1", domain: "incidents", domainLabel: "사고", variant: "incidents", date: "2026-05-22", dateDisplay: "미해결", title: "결제 오류", tier: "urgent", listRow: { id: "i1" } as never },
  { id: "s1", domain: "services", domainLabel: "서비스", variant: "services", date: "2026-05-25", dateDisplay: "5.25", title: "A대 원서접수", tier: "scheduled", listRow: { id: "s1" } as never },
];

describe("LiveOverview", () => {
  beforeEach(() => mockReducedMotion());

  it("타일과 피드 행 모두 렌더", () => {
    render(<LiveOverview mine={true} tiles={tiles} feedItems={items} />);
    // 라벨 "서비스"는 타일과 피드 행 양쪽에 등장 → getAllByText
    expect(screen.getAllByText("서비스").length).toBeGreaterThan(0);
    expect(screen.getByText("결제 오류")).toBeInTheDocument();
    expect(screen.getByText("A대 원서접수")).toBeInTheDocument();
  });
  it("칩으로 도메인 필터 시 다른 도메인 행 제거", () => {
    render(<LiveOverview mine={true} tiles={tiles} feedItems={items} />);
    // FeedChips 칩에는 aria-pressed 속성이 있으므로 정확하게 구분 가능
    const chipButtons = screen.getAllByRole("button", { name: /^사고/ });
    const chip = chipButtons.find((btn) => btn.hasAttribute("aria-pressed"));
    fireEvent.click(chip!);
    expect(screen.getByText("결제 오류")).toBeInTheDocument();
    expect(screen.queryByText("A대 원서접수")).toBeNull();
  });
  it("피드 빈 → empty 메시지", () => {
    render(<LiveOverview mine={true} tiles={tiles} feedItems={[]} />);
    expect(screen.getByText(/예정된 항목이 없습니다/)).toBeInTheDocument();
  });
});
