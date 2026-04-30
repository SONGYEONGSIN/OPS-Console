import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProjectPattern } from "../ProjectPattern";
import type { ProjectMockData } from "../../../_data/patterns";

const sample: ProjectMockData = {
  meta: {
    manager: "박지연",
    status: "진행",
    quarterTarget: "Q2 62%",
    serviceCount: "14건",
  },
  attributes: [
    { k: "담당자", v: "박지연 · 운영1팀" },
    { k: "서비스 수", v: "14건" },
  ],
  improvements: [
    { title: "접수 폼 검증", pm: "박지연", due: "2026-05-15", status: "run" },
    { title: "권한 분리", pm: "김민수", due: "2026-Q3", status: "wait" },
  ],
  activities: [
    { time: "2026-04-29", who: "박지연", act: "검증 작업 시작" },
  ],
};

describe("ProjectPattern", () => {
  it("헤더에 title + manager 노출", () => {
    render(<ProjectPattern title="PIMS" data={sample} />);
    expect(screen.getByRole("heading", { name: "PIMS", level: 2 })).toBeInTheDocument();
    expect(screen.getAllByText(/박지연/).length).toBeGreaterThan(0);
  });

  it("탭 3개 (상세/개선사항/활동 로그) 노출", () => {
    render(<ProjectPattern title="PIMS" data={sample} />);
    expect(screen.getByRole("tab", { name: /상세/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /개선사항/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /활동 로그/ })).toBeInTheDocument();
  });

  it("기본 탭은 상세 — attributes 노출", () => {
    render(<ProjectPattern title="PIMS" data={sample} />);
    expect(screen.getByText("담당자")).toBeInTheDocument();
    expect(screen.getByText("박지연 · 운영1팀")).toBeInTheDocument();
  });

  it("개선사항 탭 클릭 시 improvements 노출", () => {
    render(<ProjectPattern title="PIMS" data={sample} />);
    fireEvent.click(screen.getByRole("tab", { name: /개선사항/ }));
    expect(screen.getByText("접수 폼 검증")).toBeInTheDocument();
    expect(screen.getByText("권한 분리")).toBeInTheDocument();
  });

  it("활동 로그 탭 클릭 시 activities 노출", () => {
    render(<ProjectPattern title="PIMS" data={sample} />);
    fireEvent.click(screen.getByRole("tab", { name: /활동 로그/ }));
    expect(screen.getByText(/검증 작업 시작/)).toBeInTheDocument();
  });

  it("개선사항 탭 라벨에 카운트 노출 (2)", () => {
    render(<ProjectPattern title="PIMS" data={sample} />);
    const tab = screen.getByRole("tab", { name: /개선사항/ });
    expect(tab.textContent).toContain("2");
  });
});
