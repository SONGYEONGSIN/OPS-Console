import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
          { kind: "item" as const, ico: "·", label: "개선 요청", slug: "feedback" },
          { kind: "item" as const, ico: "·", label: "공지사항", slug: "notices" },
        ],
      },
    ],
  },
];

describe("Sidebar — active sub-item bar", () => {
  it("active sub-item에 좌측 vermilion bar 노출 (mockup folio-dashboard 매칭)", () => {
    render(<Sidebar sections={fixture} open={true} onClose={() => {}} />);
    const active = screen.getByRole("link", { name: /개선 요청/ });
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
