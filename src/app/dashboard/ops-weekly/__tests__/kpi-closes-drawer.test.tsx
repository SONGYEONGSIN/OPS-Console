import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock(
  "next/navigation",
  async () => (await import("./search-params-mock")).navigationModule,
);

// 실제 Link 는 클릭을 라우터로 넘긴다 — 우리가 가로챘는지만 보려고 앵커로 바꾼다.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ProjectDrawer } from "../_components/ProjectDrawer";
import { ProjectDrawerProvider } from "../_components/project-drawer-context";
import { ProjectSummaryCards } from "../_components/ProjectSummaryCards";
import { WeeklyKpiRow } from "../_components/WeeklyKpiRow";
import { setUrl } from "./search-params-mock";

const KPIS = { dev: 1, test: 2, opening: 3, running: 4, closing: 5, pims: 6 };
const panels = {
  project: <input aria-label="프로젝트 글" />,
  tf: <input aria-label="TF 글" />,
};

// page 가 하는 배치 그대로 — KPI 줄과 카드·서랍이 한 Provider 아래에 있다.
function renderReport() {
  return render(
    <ProjectDrawerProvider>
      <WeeklyKpiRow
        kpis={KPIS}
        ownerName="홍길동"
        weekStart="2026-11-16"
        op={null}
      />
      <ProjectSummaryCards entries={[]} checked={[]} editable />
      <ProjectDrawer panels={panels} />
    </ProjectDrawerProvider>,
  );
}

const isClosed = () =>
  screen.getByLabelText("프로젝트 글", { selector: "input" }).closest("[inert]") !==
  null;

beforeEach(() => {
  setUrl("?week=2026-11-16&tab=application");
});
afterEach(cleanup);

describe("KPI 카드는 열린 서랍을 닫는다", () => {
  it("[쓰기]로 연 서랍 — 합격자 발표 카드를 누르면 닫히고 영역만 바뀐다", () => {
    renderReport();
    const opener = screen.getByRole("button", { name: "프로젝트 쓰기" });
    opener.focus();
    fireEvent.click(opener);
    expect(isClosed()).toBe(false);

    const kpi = screen
      .getAllByRole("link")
      .find((a) => a.textContent?.includes("합격자 발표")) as HTMLElement;
    kpi.focus();
    fireEvent.click(kpi);

    expect(isClosed()).toBe(true);
    expect(window.location.search).toContain("tab=pims");
    expect(opener).not.toHaveFocus();
    expect(kpi).toHaveFocus();
  });

  it("이미 보고 있는 영역의 카드(주소가 안 바뀌는 클릭)도 닫는다", () => {
    renderReport();
    fireEvent.click(screen.getByRole("button", { name: "TF 쓰기" }));
    expect(isClosed()).toBe(false);
    fireEvent.click(screen.getByText("운영 중").closest("a") as HTMLElement);
    expect(isClosed()).toBe(true);
    expect(window.location.search).toContain("tab=application");
  });

  it("수정 키 클릭(새 탭)은 서랍을 건드리지 않는다", () => {
    renderReport();
    fireEvent.click(screen.getByRole("button", { name: "프로젝트 쓰기" }));
    fireEvent.click(screen.getByText("운영 중").closest("a") as HTMLElement, {
      ctrlKey: true,
    });
    expect(isClosed()).toBe(false);
  });
});
