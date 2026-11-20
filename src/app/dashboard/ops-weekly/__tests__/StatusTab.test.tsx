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
vi.mock("@/features/ops-weekly/workflow-actions", () => ({
  returnReport: (...a: unknown[]) => returnReport(...a),
  saveDutySummary: (...a: unknown[]) => saveDutySummary(...a),
  finalizeWeek: (...a: unknown[]) => finalizeWeek(...a),
}));

import { StatusTab } from "../_components/StatusTab";
import { inOrder } from "./heading-order";
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
  submittedCount: 0,
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

  it("권한이 없으면(forbidden) 최종 보고 아래 안내 문구가 없다", () => {
    render(
      <StatusTab
        {...base}
        finalize={{ ok: false, reason: "forbidden", pending: [] }}
      />,
    );
    expect(screen.getByRole("button", { name: "최종 보고" })).toBeDisabled();
    expect(
      screen.queryByText("당번 또는 관리자만 보고할 수 있습니다"),
    ).toBeNull();
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

  it("제출 현황에는 당번 바꾸기·정정이 없다 — 관리자 · 열린 주든 보고된 주든", () => {
    render(
      <StatusTab {...base} actor={{ email: "z@x", isAdmin: true }} />,
    );
    expect(screen.queryByLabelText("당번")).toBeNull();
    expect(screen.queryByRole("button", { name: "정정" })).toBeNull();
    cleanup();
    render(
      <StatusTab
        {...base}
        actor={{ email: "z@x", isAdmin: true }}
        week={{
          ...WEEK,
          status: "reported",
          reported_at: "2026-11-20T08:00:00Z",
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: "정정" })).toBeNull();
    expect(screen.queryByLabelText("당번")).toBeNull();
  });

  it("받는 사람(당번·관리자 아님)이 보고된 주를 열면 버튼이 하나도 없다", () => {
    render(
      <StatusTab
        {...base}
        actor={{ email: "r@x", isAdmin: false }}
        week={{
          ...WEEK,
          status: "reported",
          reported_at: "2026-11-20T08:00:00Z",
        }}
        reports={[rep("a@x", "submitted")]}
      />,
    );
    for (const name of ["다시 작성", "최종 보고", "정정"]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    expect(screen.queryAllByRole("textbox")).toHaveLength(0); // 당번 총평 읽기 전용
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

  describe("가독성", () => {
    const tokens = (el: Element) => el.className.split(/\s+/);
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;

    it("절 머리 — h2 + 제출 수, 최종 보고는 같은 행 오른쪽", () => {
      render(<StatusTab {...base} submittedCount={1} />);
      const h = screen.getByRole("heading", { name: "제출 현황" });
      expect(tokens(h)).toContain("text-xl");
      expect(tokens(h)).toContain("font-bold");
      expect(screen.getByText("1/2명")).toBeInTheDocument();
      const button = screen.getByRole("button", { name: "최종 보고" });
      const bar = button.parentElement as Element;
      expect(tokens(bar)).toContain("items-end");
      let row: Element | null = bar;
      while (row && !tokens(row).includes("justify-between"))
        row = row.parentElement;
      expect(row).not.toBeNull();
      expect(row?.contains(h)).toBe(true);
      expect(h.compareDocumentPosition(button) & FOLLOWING).toBeTruthy();
    });

    it("비활성 사유는 버튼 바로 아래 오른쪽 정렬", () => {
      render(
        <StatusTab
          {...base}
          finalize={{ ok: false, reason: "pending", pending: ["b@x"] }}
        />,
      );
      const button = screen.getByRole("button", { name: "최종 보고" });
      const why = screen.getByText("미제출: 운영자B");
      expect(button.nextElementSibling).toBe(why);
      expect(tokens(why)).toContain("text-right");
    });

    it("실패 메시지는 절 머리 뒤 표 앞에 있다", async () => {
      finalizeWeek.mockResolvedValue({ ok: false, error: "보고 실패" });
      render(<StatusTab {...base} />);
      fireEvent.click(screen.getByRole("button", { name: "최종 보고" }));
      fireEvent.click(screen.getByRole("button", { name: "보고하기" }));
      const msg = await screen.findByText("보고 실패");
      expect(msg.getAttribute("role")).toBe("alert");
      expect(tokens(msg)).toContain("text-vermilion");
      const h = screen.getByRole("heading", { name: "제출 현황" });
      expect(h.compareDocumentPosition(msg) & FOLLOWING).toBeTruthy();
      expect(
        msg.compareDocumentPosition(screen.getByRole("table")) & FOLLOWING,
      ).toBeTruthy();
    });

    it("제목 순서 — 제출 현황 > 주요 > 모아보기, 모두 h2", () => {
      render(<StatusTab {...base} />);
      const names = ["제출 현황", "주요 (운영부 전체)", "프로젝트·TF 모아보기"];
      inOrder(names);
      for (const name of names)
        expect(screen.getByRole("heading", { name }).tagName).toBe("H2");
    });

    it("프로젝트 모아보기의 항목 제목은 h3 로 한 단계 올라간다", () => {
      render(
        <StatusTab
          {...base}
          projectGroups={[
            {
              projectId: "p1",
              projectName: "통합원서",
              kind: "project",
              owners: [pe("운영자A")],
            } as unknown as ProjectGroup,
          ]}
        />,
      );
      expect(screen.getByRole("heading", { name: /통합원서/ }).tagName).toBe(
        "H3",
      );
    });

    it("명단이 비면 표 대신 빈 상태 상자", () => {
      render(
        <StatusTab
          {...base}
          writers={[]}
          finalize={{ ok: false, reason: "empty-roster", pending: [] }}
        />,
      );
      expect(screen.queryByRole("table")).toBeNull();
      const box = screen.getByText("작성 대상 명단이 비어 있습니다")
        .parentElement as Element;
      expect(tokens(box)).toContain("bg-situation-bg");
    });

    it("상태 칸 색 — 미제출 muted / 다시 작성 vermilion / 제출 ink", () => {
      render(
        <StatusTab
          {...base}
          writers={[wa, wb, wc]}
          reports={[rep("a@x", "submitted"), rep("b@x", "returned")]}
        />,
      );
      const cell = (name: string, text: string) =>
        within(row(name)).getByText(text);
      expect(tokens(cell("운영자A", "제출"))).toContain("text-ink");
      expect(tokens(cell("운영자B", "다시 작성 요청"))).toContain(
        "text-vermilion",
      );
      expect(tokens(cell("운영자C", "미제출"))).toContain("text-muted");
    });

    it("admin 에게만 명단 빈 상자에 설정 링크", () => {
      const admin = { email: "d@x", isAdmin: true };
      render(
        <StatusTab
          {...base}
          actor={admin}
          writers={[]}
          finalize={{ ok: false, reason: "empty-roster", pending: [] }}
        />,
      );
      expect(
        screen.getByRole("link", { name: "설정 열기" }),
      ).toHaveAttribute("href", expect.stringContaining("section=exclusions"));
    });
  });
});
