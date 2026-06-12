import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { KpiHeroStrip } from "../KpiHeroStrip";

const kpi = {
  sago: { count: 3, sparklineD: "M 0,30 L 100,2" },
  todo: { count: 7, done: 5, total: 12 },
  service: { count: 8, sparklineD: "M 0,35 L 100,12" },
};

describe("KpiHeroStrip", () => {
  it("3종 KPI 라벨을 렌더한다", () => {
    render(<KpiHeroStrip kpi={kpi} />);
    expect(screen.getByText("사고 미해결")).toBeInTheDocument();
    expect(screen.getByText("내 할 일")).toBeInTheDocument();
    expect(screen.getByText("서비스 마감예정")).toBeInTheDocument();
  });

  it("사고/서비스 count를 노출한다", () => {
    render(<KpiHeroStrip kpi={kpi} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("내 할 일 done/total + 완료율(%)을 노출한다", () => {
    render(<KpiHeroStrip kpi={kpi} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("/12")).toBeInTheDocument();
    // 5/12 = 41.67 → 42%
    expect(screen.getByText("42% 완료")).toBeInTheDocument();
  });

  it("total=0이면 완료율 0%", () => {
    render(
      <KpiHeroStrip kpi={{ ...kpi, todo: { count: 0, done: 0, total: 0 } }} />,
    );
    expect(screen.getByText("0% 완료")).toBeInTheDocument();
  });

  it("각 타일이 해당 도메인으로 링크된다", () => {
    render(<KpiHeroStrip kpi={kpi} />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/dashboard/incidents");
    expect(hrefs).toContain("/dashboard/my-todo");
    expect(hrefs).toContain("/dashboard/services");
  });

  it("사고/서비스 스파크라인 path가 렌더된다", () => {
    const { container } = render(<KpiHeroStrip kpi={kpi} />);
    const paths = Array.from(container.querySelectorAll("path")).map((p) =>
      p.getAttribute("d"),
    );
    expect(paths).toContain("M 0,30 L 100,2");
    expect(paths).toContain("M 0,35 L 100,12");
  });
});
