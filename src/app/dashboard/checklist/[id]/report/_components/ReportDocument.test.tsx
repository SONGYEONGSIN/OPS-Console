import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ChecklistRound } from "@/features/checklist/schemas";
import { ReportDocument } from "./ReportDocument";

vi.mock("@/features/checklist/report-actions", () => ({
  generateChecklistReport: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const base: ChecklistRound = {
  id: "r1",
  title: "2027 수시",
  periodStart: null,
  periodEnd: null,
  status: "active",
  createdBy: null,
  createdAt: "2026-07-20T00:00:00Z",
  reportHtml: null,
  reportGeneratedAt: null,
};

describe("ReportDocument", () => {
  it("리포트 없으면 '리포트 생성' 버튼 + 빈 상태 안내", () => {
    render(<ReportDocument round={base} />);
    expect(screen.getByRole("button", { name: "리포트 생성" })).toBeTruthy();
    expect(screen.getByText(/아직 생성된 보고리포트가 없습니다/)).toBeTruthy();
  });

  it("리포트 있으면 내용 렌더 + '재생성' 버튼", () => {
    render(
      <ReportDocument
        round={{
          ...base,
          reportHtml: "<h2>요약</h2><p>전체 완료율 79%</p>",
          reportGeneratedAt: "2026-07-23T01:00:00Z",
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "재생성" })).toBeTruthy();
    expect(screen.getByText("요약")).toBeTruthy();
    expect(screen.getByText(/전체 완료율 79%/)).toBeTruthy();
  });
});
