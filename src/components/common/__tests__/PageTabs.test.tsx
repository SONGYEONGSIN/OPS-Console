import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageTabs } from "../PageTabs";

const tabs = [
  { key: "univ", label: "대학배정", href: "/dashboard/assignments?tab=univ" },
  { key: "duties", label: "업무분장", href: "/dashboard/assignments?tab=duties" },
  { key: "pricing", label: "가격정책", href: "/dashboard/assignments?tab=pricing" },
];

describe("PageTabs", () => {
  it("모든 탭 라벨을 href 링크로 렌더", () => {
    render(<PageTabs active="univ" tabs={tabs} />);
    const univ = screen.getByRole("link", { name: "대학배정" });
    expect(univ).toHaveAttribute("href", "/dashboard/assignments?tab=univ");
    expect(screen.getByRole("link", { name: "업무분장" })).toHaveAttribute(
      "href",
      "/dashboard/assignments?tab=duties",
    );
    expect(screen.getByRole("link", { name: "가격정책" })).toBeInTheDocument();
  });

  it("활성 탭만 aria-current='page'", () => {
    render(<PageTabs active="duties" tabs={tabs} />);
    expect(screen.getByRole("link", { name: "업무분장" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "대학배정" }),
    ).not.toHaveAttribute("aria-current");
  });
});
