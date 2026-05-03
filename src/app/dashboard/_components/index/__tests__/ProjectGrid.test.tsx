import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectGrid, type ProjectEntryItem } from "../ProjectGrid";

const sampleProjects: ProjectEntryItem[] = [
  { slug: "pims",            label: "PIMS",          manager: "박지연", quarter: "Q2 · 62%", count: "14건" },
  { slug: "reception-admin", label: "접수관리자",     manager: "김민수", quarter: "Q2 · 48%", count: "8건" },
  { slug: "internal-admin",  label: "내부관리자",     manager: "이지훈", quarter: "Q2 · 55%", count: "6건" },
  { slug: "competition",     label: "경쟁률",         manager: "정수아", quarter: "Q2 · 70%", count: "3건" },
  { slug: "generator",       label: "생성툴",         manager: "최영준", quarter: "Q2 · 35%", count: "2건" },
  { slug: "revenue",         label: "매출 분석",      manager: "박지연", quarter: "Q2 · 80%", count: "5건" },
  { slug: "jh-cash",         label: "정산 · 진학캐쉬",manager: "한지민", quarter: "Q2 · 45%", count: "1건" },
  { slug: "k12",             label: "초중고 사업",    manager: "송영석", quarter: "Q2 · 25%", count: "준비" },
  { slug: "kcue",            label: "대교협 연계",    manager: "정수아", quarter: "Q2 · 30%", count: "2건" },
  { slug: "referral",        label: "추천인 검증",    manager: "김유민", quarter: "Q2 · 65%", count: "7건" },
  { slug: "guarantee",       label: "보증보험",       manager: "임종우", quarter: "Q3 예정",  count: "검토", suspended: true },
  { slug: "performance",     label: "실적증명",       manager: "이해영", quarter: "Q2 · 50%", count: "4건" },
];

describe("ProjectGrid", () => {
  it("12개 프로젝트 entry 모두 렌더", () => {
    render(<ProjectGrid items={sampleProjects} />);
    sampleProjects.forEach((p) => {
      expect(screen.getByText(p.label)).toBeInTheDocument();
    });
  });

  it("각 entry는 /dashboard/<slug> 링크", () => {
    const { container } = render(<ProjectGrid items={sampleProjects} />);
    const links = container.querySelectorAll('a[href^="/dashboard/"]');
    expect(links.length).toBe(12);
    expect(container.querySelector('a[href="/dashboard/pims"]')).not.toBeNull();
    expect(container.querySelector('a[href="/dashboard/jh-cash"]')).not.toBeNull();
  });

  it("manager / quarter / count 메타 정보 노출", () => {
    render(<ProjectGrid items={sampleProjects} />);
    expect(screen.getAllByText(/박지연/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Q2 · 62%/)).toBeInTheDocument();
    expect(screen.getByText(/14건/)).toBeInTheDocument();
  });

  it("suspended 프로젝트는 'paused' 상태 마커 노출", () => {
    render(<ProjectGrid items={sampleProjects} />);
    expect(screen.getByText(/보류/)).toBeInTheDocument();
  });

  it("active 프로젝트는 'paused' 마커 노출 안 함 (1회 제한)", () => {
    render(<ProjectGrid items={sampleProjects} />);
    const paused = screen.getAllByText(/보류/);
    expect(paused.length).toBe(1);
  });
});
