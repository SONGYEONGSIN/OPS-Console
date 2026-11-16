import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
const returnReport = vi.fn();
const saveDutySummary = vi.fn();
const finalizeWeek = vi.fn();
const reopenWeek = vi.fn();
vi.mock("@/features/ops-weekly/workflow-actions", () => ({
  returnReport: (...a: unknown[]) => returnReport(...a),
  saveDutySummary: (...a: unknown[]) => saveDutySummary(...a),
  finalizeWeek: (...a: unknown[]) => finalizeWeek(...a),
  reopenWeek: (...a: unknown[]) => reopenWeek(...a),
}));
const setWeekDuty = vi.fn();
vi.mock("@/features/ops-weekly/settings-actions", () => ({
  setWeekDuty: (...a: unknown[]) => setWeekDuty(...a),
}));

import { StatusTab } from "../_components/StatusTab";
import type { ReportRow, WeekRow } from "@/features/ops-weekly/schemas";
import type {
  ProjectEntryView,
  ProjectGroup,
} from "@/features/ops-weekly/merge";
import type { FinalizeCheck } from "@/features/ops-weekly/permissions";

const WEEK: WeekRow = {
  id: "w1",
  week_start: "2026-11-16",
  label_year: 2026,
  label_month: 11,
  label_week: 3,
  duty_email: "d@x",
  summary_this: "",
  summary_next: "",
  status: "open",
  reported_at: null,
  reported_by: null,
  reopened_at: null,
  reopened_by: null,
};
const cand = (email: string, name: string) => ({
  email,
  name,
  team: "개발팀",
  role: "사원",
  status: "active",
});
const wa = cand("a@x", "운영자A");
const wb = cand("b@x", "운영자B");
const wc = cand("c@x", "운영자C");
const rep = (email: string, status: ReportRow["status"]): ReportRow => ({
  id: `r-${email}`,
  week_id: "w1",
  operator_email: email,
  status,
  submitted_at: status === "submitted" ? "2026-11-18T01:00:00.000Z" : null,
  returned_at: null,
  returned_by: null,
  return_reason: null,
  snapshot: null,
  checked_tabs: [],
});
const pe = (name: string): ProjectEntryView => ({
  projectId: "p1",
  projectName: "PIMS",
  kind: "project",
  sortOrder: 1,
  operatorEmail: "a@x",
  operatorName: name,
  stage: null,
  thisWeek: "",
  nextWeek: "",
});
const ok: FinalizeCheck = { ok: true };
const base = {
  week: WEEK,
  actor: { email: "d@x", isAdmin: false },
  writers: [wa, wb],
  reports: [] as ReportRow[],
  projectGroups: [] as ProjectGroup[],
  finalize: ok,
};
const row = (name: string) => {
  const tr = screen.getByText(name).closest("tr");
  if (tr === null) throw new Error(`row ${name}`);
  return tr;
};
const rowText = (name: string) => row(name).textContent ?? "";

beforeEach(() => {
  refresh.mockReset();
  returnReport.mockReset().mockResolvedValue({ ok: true });
  saveDutySummary.mockReset().mockResolvedValue({ ok: true });
  finalizeWeek.mockReset().mockResolvedValue({ ok: true });
  reopenWeek.mockReset().mockResolvedValue({ ok: true });
  setWeekDuty.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe("StatusTab", () => {
  it("최종 보고는 전원 제출 전에는 꺼져 있고 미제출자를 적는다", () => {
    render(
      <StatusTab
        {...base}
        finalize={{ ok: false, reason: "pending", pending: ["b@x"] }}
      />,
    );
    expect(screen.getByRole("button", { name: "최종 보고" })).toBeDisabled();
    expect(screen.getByText("미제출: 운영자B")).toBeInTheDocument();
  });

  it("빈 명단이면 꺼져 있다 — 0/0 을 전원 제출로 보지 않는다", () => {
    render(
      <StatusTab
        {...base}
        writers={[]}
        finalize={{ ok: false, reason: "empty-roster", pending: [] }}
      />,
    );
    expect(screen.getByRole("button", { name: "최종 보고" })).toBeDisabled();
    expect(
      screen.getByText("작성 대상 명단을 읽지 못했습니다"),
    ).toBeInTheDocument();
  });

  it("권한이 없으면 이유를 적는다", () => {
    render(
      <StatusTab
        {...base}
        finalize={{ ok: false, reason: "forbidden", pending: [] }}
      />,
    );
    expect(screen.getByRole("button", { name: "최종 보고" })).toBeDisabled();
    expect(
      screen.getByText("당번 또는 관리자만 보고할 수 있습니다"),
    ).toBeInTheDocument();
  });

  it("상태 세 가지 + 보고서 행이 없으면 미제출", () => {
    render(
      <StatusTab
        {...base}
        writers={[wa, wb, wc]}
        reports={[rep("a@x", "submitted"), rep("b@x", "returned")]}
      />,
    );
    expect(rowText("운영자A")).toContain("제출");
    expect(rowText("운영자A")).not.toContain("미제출");
    expect(rowText("운영자B")).toContain("다시 작성 요청");
    expect(rowText("운영자C")).toContain("미제출");
  });

  it("보고서 이메일 대소문자가 달라도 같은 사람으로 맞춘다", () => {
    render(<StatusTab {...base} reports={[rep("A@X", "submitted")]} />);
    expect(rowText("운영자A")).not.toContain("미제출");
  });

  it("[다시 작성] 은 당번에게, 제출한 행에만", () => {
    render(
      <StatusTab
        {...base}
        actor={{ email: "d@x", isAdmin: false }}
        reports={[rep("a@x", "submitted")]}
        writers={[wa, wb]}
      />,
    );
    expect(
      within(row("운영자A")).getByRole("button", { name: "다시 작성" }),
    ).toBeInTheDocument();
    expect(
      within(row("운영자B")).queryByRole("button", { name: "다시 작성" }),
    ).toBeNull();
  });

  it("당번 이메일이 대문자여도 당번으로 본다 — 다시 작성·주요 편집", () => {
    render(
      <StatusTab
        {...base}
        week={{ ...WEEK, duty_email: "D@x" }}
        reports={[rep("a@x", "submitted")]}
      />,
    );
    expect(
      within(row("운영자A")).getByRole("button", { name: "다시 작성" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("금주")).toBeInTheDocument();
  });

  it("[다시 작성] 은 당번이 아니면 안 보인다", () => {
    render(
      <StatusTab
        {...base}
        actor={{ email: "z@x", isAdmin: false }}
        reports={[rep("a@x", "submitted")]}
      />,
    );
    expect(screen.queryByRole("button", { name: "다시 작성" })).toBeNull();
  });

  it("[다시 작성] 은 사유를 받아 returnReport 를 부르고 새로 읽는다", async () => {
    render(<StatusTab {...base} reports={[rep("a@x", "submitted")]} />);
    fireEvent.click(
      within(row("운영자A")).getByRole("button", { name: "다시 작성" }),
    );
    fireEvent.change(screen.getByLabelText("사유"), {
      target: { value: "수치 확인" },
    });
    fireEvent.click(screen.getByRole("button", { name: "요청 보내기" }));
    await waitFor(() => {
      expect(returnReport).toHaveBeenCalledWith({
        reportId: "r-a@x",
        reason: "수치 확인",
      });
    });
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("[정정] 은 admin · 보고된 주에만", () => {
    const reported = { ...WEEK, status: "reported" as const };
    render(
      <StatusTab
        {...base}
        week={reported}
        actor={{ email: "z@x", isAdmin: true }}
      />,
    );
    expect(screen.getByRole("button", { name: "정정" })).toBeInTheDocument();
    cleanup();
    render(
      <StatusTab
        {...base}
        week={reported}
        actor={{ email: "d@x", isAdmin: false }}
      />,
    );
    expect(screen.queryByRole("button", { name: "정정" })).toBeNull();
  });

  it("[정정] 은 reopenWeek 를 부른다", async () => {
    render(
      <StatusTab
        {...base}
        week={{ ...WEEK, status: "reported" }}
        actor={{ email: "z@x", isAdmin: true }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "정정" }));
    await waitFor(() => {
      expect(reopenWeek).toHaveBeenCalledWith({ weekId: "w1" });
    });
  });

  it("최종 보고는 확인창을 거쳐 finalizeWeek 를 부른다", async () => {
    render(<StatusTab {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "최종 보고" }));
    expect(finalizeWeek).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "보고하기" }));
    await waitFor(() => {
      expect(finalizeWeek).toHaveBeenCalledWith({ weekId: "w1" });
    });
    await waitFor(() => {
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("최종 보고가 실패 문구를 돌려줘도 새로 읽는다", async () => {
    finalizeWeek.mockResolvedValue({ ok: false, error: "후속 처리 실패" });
    render(<StatusTab {...base} />);
    fireEvent.click(screen.getByRole("button", { name: "최종 보고" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "보고하기",
      }),
    );
    expect(await screen.findByText("후속 처리 실패")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("주요 요약은 당번이 아니면 읽기 전용", () => {
    render(<StatusTab {...base} actor={{ email: "z@x", isAdmin: false }} />);
    expect(screen.queryByLabelText("금주")).toBeNull();
  });

  it("주요 요약은 당번이 blur 하면 저장한다", async () => {
    render(<StatusTab {...base} />);
    const box = screen.getByLabelText("금주");
    fireEvent.change(box, { target: { value: "주요 사항" } });
    fireEvent.blur(box);
    await waitFor(() => {
      expect(saveDutySummary).toHaveBeenCalledWith({
        weekId: "w1",
        thisWeek: "주요 사항",
        nextWeek: "",
      });
    });
  });

  it("당번 바꾸기는 admin · 열린 주에만", () => {
    render(<StatusTab {...base} actor={{ email: "z@x", isAdmin: true }} />);
    expect(screen.getByLabelText("당번")).toBeInTheDocument();
    cleanup();
    render(<StatusTab {...base} />);
    expect(screen.queryByLabelText("당번")).toBeNull();
  });

  it("프로젝트 모아보기 — 항목 아래 담당자별", () => {
    render(
      <StatusTab
        {...base}
        projectGroups={[
          {
            projectId: "p1",
            projectName: "PIMS",
            kind: "project",
            owners: [pe("운영자A"), pe("운영자B")],
          },
        ]}
      />,
    );
    const region = screen.getByRole("region", { name: "PIMS" });
    expect(
      within(region)
        .getAllByTestId("owner-name")
        .map((n) => n.textContent),
    ).toEqual(["운영자A", "운영자B"]);
  });

  it("프로젝트가 TF 보다 먼저 나온다", () => {
    const g = (id: string, kind: "project" | "tf"): ProjectGroup => ({
      projectId: id,
      projectName: id,
      kind,
      owners: [{ ...pe("운영자A"), projectId: id, projectName: id, kind }],
    });
    render(
      <StatusTab
        {...base}
        projectGroups={[g("TF-1", "tf"), g("PRJ-1", "project")]}
      />,
    );
    const names = screen
      .getAllByRole("region")
      .map((r) => r.getAttribute("aria-label"));
    expect(names.indexOf("PRJ-1")).toBeLessThan(names.indexOf("TF-1"));
  });
});
