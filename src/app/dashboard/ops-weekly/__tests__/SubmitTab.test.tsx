import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import type { ProjectEntryView } from "@/features/ops-weekly/merge";

const submitReport = vi.fn();
vi.mock("@/features/ops-weekly/workflow-actions", () => ({
  submitReport: (...a: unknown[]) => submitReport(...a),
}));
vi.mock(
  "next/navigation",
  async () => (await import("./search-params-mock")).navigationModule,
);

import { SubmitTab } from "../_components/SubmitTab";
import { setUrl } from "./search-params-mock";
import { EMPTY, manualLeave, snap } from "./tab-fixtures";

const entry = (over: Partial<ProjectEntryView> = {}): ProjectEntryView => ({
  projectId: "p1",
  projectName: "PIMS",
  kind: "project",
  sortOrder: 1,
  operatorEmail: "a@x",
  operatorName: "운영자A",
  stage: "개발",
  thisWeek: "<p>화면 개선</p>",
  nextWeek: "",
  ...over,
});

const detail = {
  ...EMPTY,
  notes: {
    ...EMPTY.notes,
    application: { thisWeek: "가대학교 일정 변경", nextWeek: "" },
  },
  manual: [manualLeave()],
  projects: [entry()],
};

const base = {
  snapshot: snap({ pimsThis: ["pims:a", "pims:b"] }),
  detail,
  reportId: "r1",
  canSubmit: true,
  status: "draft" as const,
  submittedAt: null,
};

const block = (name: string) => screen.getByRole("region", { name });

beforeEach(() => {
  submitReport.mockReset().mockResolvedValue({ ok: true });
  setUrl("?week=2026-11-16&tab=submit");
});

describe("SubmitTab — 제출 전 검토", () => {
  it("영역 넷을 묶음으로 — 머리에 자동·직접 건수(탭 제목과 같은 숫자)", () => {
    render(<SubmitTab {...base} />);
    expect(
      within(block("원서접수")).getByText("자동 0건 · 직접 0건"),
    ).toBeInTheDocument();
    expect(
      within(block("합격자 발표")).getByText("자동 2건 · 직접 0건"),
    ).toBeInTheDocument();
    expect(
      within(block("휴가·외근")).getByText("자동 0건 · 직접 1건"),
    ).toBeInTheDocument();
    expect(block("프로젝트·TF")).toBeInTheDocument();
  });

  it("특이사항은 본문 그대로, 비었으면 '없음'", () => {
    render(<SubmitTab {...base} />);
    const app = block("원서접수");
    expect(within(app).getByText("가대학교 일정 변경")).toBeInTheDocument();
    expect(within(app).getAllByText("없음")).toHaveLength(1);
    expect(within(block("합격자 발표")).getAllByText("없음")).toHaveLength(2);
  });

  it("프로젝트·TF 는 항목별 이름·단계와 이번 주/다음 주", () => {
    render(<SubmitTab {...base} />);
    const pt = block("프로젝트·TF");
    expect(within(pt).getByText("PIMS · 개발")).toBeInTheDocument();
    expect(within(pt).getByText("화면 개선")).toBeInTheDocument();
    expect(within(pt).getByText("맡은 TF가 없습니다")).toBeInTheDocument();
  });

  it("묶음 머리를 누르면 그 영역 탭으로 간다", () => {
    render(<SubmitTab {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "합격자 발표로 가기" }));
    expect(new URLSearchParams(window.location.search).get("tab")).toBe("pims");
  });

  it("제출완료 를 누르면 제출한다", async () => {
    render(<SubmitTab {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() =>
      expect(submitReport).toHaveBeenCalledWith({ reportId: "r1" }),
    );
  });

  it("제출했으면 버튼 대신 제출함 시각", () => {
    render(
      <SubmitTab
        {...base}
        canSubmit={false}
        status="submitted"
        submittedAt="2026-11-23T05:05:00.000Z"
      />,
    );
    expect(screen.queryByRole("button", { name: "제출완료" })).toBeNull();
    expect(screen.getByText(/^제출함 /)).toBeInTheDocument();
  });
});
