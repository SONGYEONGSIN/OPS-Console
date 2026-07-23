import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const h = vi.hoisted(() => ({
  getRoundByToken: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NF");
  }),
}));
vi.mock("@/features/checklist/queries", () => ({
  getRoundByToken: h.getRoundByToken,
}));
vi.mock("next/navigation", () => ({ notFound: h.notFound }));
vi.mock("./_components/FillForm", () => ({
  FillForm: () => <div data-testid="fill" />,
}));
vi.mock("./_components/ReportView", () => ({
  ReportView: () => <div data-testid="reportview" />,
}));
vi.mock("@/components/checklist/ReportBody", () => ({
  ReportBody: () => <div data-testid="reportbody" />,
}));

import Page from "./page";

const round = {
  id: "r1",
  title: "t",
  periodStart: null,
  periodEnd: null,
  status: "active" as const,
  createdBy: null,
  createdAt: "2026-07-20",
  reportHtml: null as string | null,
  reportGeneratedAt: null,
};
const data = (kind: "fill" | "report", reportHtml: string | null) => ({
  round: { ...round, reportHtml },
  items: [],
  token: {
    id: "t1",
    roundId: "r1",
    kind,
    department: null,
    token: "tok",
    enabled: true,
  },
});
const call = () => Page({ params: Promise.resolve({ token: "tok" }) });

describe("공개 체크리스트 링크", () => {
  it("fill 토큰 → 작성폼", async () => {
    h.getRoundByToken.mockResolvedValue(data("fill", null));
    render(await call());
    expect(screen.getByTestId("fill")).toBeTruthy();
  });
  it("report 토큰 + reportHtml → AI 보고리포트(ReportBody)", async () => {
    h.getRoundByToken.mockResolvedValue(data("report", "<h2>요약</h2>"));
    render(await call());
    expect(screen.getByTestId("reportbody")).toBeTruthy();
  });
  it("report 토큰 + reportHtml 없음 → ReportView 폴백", async () => {
    h.getRoundByToken.mockResolvedValue(data("report", null));
    render(await call());
    expect(screen.getByTestId("reportview")).toBeTruthy();
  });
  it("무효 토큰 → notFound", async () => {
    h.getRoundByToken.mockResolvedValue(null);
    await expect(call()).rejects.toThrow("NF");
  });
});
