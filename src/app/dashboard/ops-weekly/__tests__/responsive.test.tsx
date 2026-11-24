import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/ops-weekly/settings-actions", () => ({
  addRecipient: vi.fn(),
  removeRecipient: vi.fn(),
  saveRotation: vi.fn(),
  upsertProject: vi.fn(),
  setProjectOwners: vi.fn(),
}));

import { SubmissionTable } from "../_components/SubmissionTable";
import { ProjectCatalogPanel } from "../_components/ProjectCatalogPanel";
import { RotationPanel } from "../_components/RotationPanel";
import { RecipientsPanel } from "../_components/RecipientsPanel";
import { ReadOnlyHtml } from "../_components/ProjectTab";
import { OverrideControls } from "../_components/OverrideControls";
import { ProjectOverview } from "../_components/ProjectOverview";
import { AutoFreezeNotice } from "../_components/AutoFreezeNotice";
import { WeeklyKpiRow } from "../_components/WeeklyKpiRow";
import type { WeekRow } from "@/features/ops-weekly/schemas";

afterEach(cleanup);

const writer = {
  email: "a@x",
  name: "운영자A",
  team: "운영1팀",
  role: "사원",
  status: "active",
};

const tokens = (el: Element) => el.className.split(/\s+/);

describe("주간업무보고 반응형 — 모양 단언", () => {
  it("제출 표는 가로 스크롤 래퍼 안에 있다", () => {
    render(
      <SubmissionTable
        week={{ id: "w1", week_start: "2026-11-16" } as WeekRow}
        writers={[writer]}
        reports={[]}
        canReturn={() => false}
        onReturn={vi.fn()}
      />,
    );
    const table = screen.getByRole("table");
    expect(tokens(table.parentElement as Element)).toContain("overflow-x-auto");
    expect(tokens(table).some((c) => c.startsWith("min-w-"))).toBe(true);
  });

  it("프로젝트 목록 표는 가로 스크롤 래퍼 안에 있다", () => {
    render(
      <ProjectCatalogPanel
        projects={[]}
        writers={[writer]}
        candidates={[writer]}
      />,
    );
    const table = screen.getByRole("table");
    expect(tokens(table.parentElement as Element)).toContain("overflow-x-auto");
    expect(tokens(table).some((c) => c.startsWith("min-w-"))).toBe(true);
  });

  it("프로젝트·TF 담당자 버튼은 ON | OFF 칸과 같은 크기, 행은 세로 가운데(위아래 간격 같게)", () => {
    render(
      <ProjectCatalogPanel
        projects={[
          { id: "p1", name: "PIMS", kind: "project", sortOrder: 10, active: true, owners: [] },
        ]}
        writers={[writer]}
        candidates={[writer]}
      />,
    );
    const owner = screen.getByRole("button", { pressed: false, name: /운영자A/ });
    expect(tokens(owner)).toEqual(
      expect.arrayContaining(["px-3", "py-1", "text-xs", "border-line"]),
    );
    expect(tokens(owner)).not.toContain("py-0.5");
    const tr = screen.getByDisplayValue("PIMS").closest("tr") as HTMLElement;
    expect(tokens(tr)).toContain("align-middle");
    expect(tokens(tr)).not.toContain("align-top");
  });

  it("KPI 는 폰·태블릿 3열, lg 부터 한 줄 6열 — 고아 칸이 없다", () => {
    render(
      <WeeklyKpiRow
        weekStart="2026-11-16"
        op={null}
        ownerName="홍길동"
        kpis={{ dev: 1, test: 1, opening: 1, running: 1, closing: 1, pims: 1 }}
      />,
    );
    const grid = screen.getAllByTestId("weekly-kpi-label")[0].closest(".grid");
    const t = tokens(grid as Element);
    expect(t).toContain("grid-cols-3");
    expect(t).toContain("lg:grid-cols-5");
    expect(t).not.toContain("lg:grid-cols-6");
    expect(t).not.toContain("grid-cols-2");
    expect(t).toContain("px-5");
    expect(t).toContain("lg:px-7");
    // 캡션이 위에 붙으면서 그리드 위 여백이 줄었다 — 캡션도 같은 좌우 여백
    expect(t).toContain("pt-2");
    const caption = screen.getByText(/^홍길동의 이번 주/);
    expect(tokens(caption)).toContain("px-5");
    expect(tokens(caption)).toContain("lg:px-7");
  });

  it("제출 표는 명단이 비면 표 대신 빈 상태 상자", () => {
    render(
      <SubmissionTable
        week={{ id: "w1", week_start: "2026-11-16" } as WeekRow}
        writers={[]}
        reports={[]}
        canReturn={() => false}
        onReturn={vi.fn()}
      />,
    );
    expect(screen.queryByRole("table")).toBeNull();
    const box = screen.getByText("작성 대상 명단이 비어 있습니다")
      .parentElement as Element;
    expect(tokens(box)).toContain("bg-situation-bg");
  });

  it("당번 순번·받는 사람 표는 좁은 화면에서 가로 스크롤한다", () => {
    const { unmount } = render(
      <RotationPanel
        rotation={["a@x"]}
        anchorWeekStart={null}
        writers={[writer]}
      />,
    );
    expect(tokens(screen.getByRole("table").parentElement as Element)).toContain(
      "overflow-x-auto",
    );
    unmount();
    render(
      <RecipientsPanel
        recipients={[{ email: "a@x", name: "운영자A", warning: null }] as never}
        candidates={[writer]}
      />,
    );
    expect(tokens(screen.getByRole("table").parentElement as Element)).toContain(
      "overflow-x-auto",
    );
  });
  it("프로젝트 모아보기의 담당자 줄은 줄바꿈되고 긴 이름이 넘치지 않는다", () => {
    render(
      <ProjectOverview
        groups={[
          {
            projectId: "p1",
            projectName: "프로젝트",
            kind: "project",
            owners: [
              {
                operatorEmail: "a@x",
                operatorName: "운영자A",
                stage: null,
                thisWeek: "",
                nextWeek: "",
              },
            ],
          } as never,
        ]}
      />,
    );
    const name = screen.getByTestId("owner-name");
    expect(tokens(name)).toContain("break-words");
    expect(tokens(name.parentElement as Element)).toContain("flex-wrap");
  });

  it("읽기 전용 HTML 은 긴 URL 을 어디서든 줄바꿈하고 표는 가로 스크롤한다", () => {
    const { container } = render(
      <ReadOnlyHtml label="금주" html="<p>https://example.com/very/long</p>" />,
    );
    const root = container.firstElementChild as Element;
    expect(tokens(root)).toContain("min-w-0");
    const body = root.querySelector("div") as Element;
    expect(tokens(body)).toContain("overflow-x-auto");
    expect(tokens(body)).toContain("[overflow-wrap:anywhere]");
  });

  it("읽기 전용 건 메모는 줄바꿈된다", () => {
    render(
      <OverrideControls
        reportId={null}
        itemKey="k"
        area="application"
        note="긴메모"
        excluded={false}
        editable={false}
      />,
    );
    expect(tokens(screen.getByText("긴메모"))).toContain("break-words");
  });

  it("굳는 시점 안내는 좁은 폭에서 줄바꿈된다", () => {
    render(<AutoFreezeNotice />);
    const el = screen.getByText("자동 항목은 최종 보고 때 굳습니다");
    for (const c of ["whitespace-nowrap", "truncate"]) {
      expect(tokens(el)).not.toContain(c);
    }
    expect(tokens(el).some((c) => /^(w|min-w)-\[/.test(c))).toBe(false);
    expect(tokens(el)).toContain("text-muted");
    expect(tokens(el)).not.toContain("text-vermilion");
  });
});
