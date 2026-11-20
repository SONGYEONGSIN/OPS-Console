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

const input = () =>
  screen.getByLabelText("프로젝트 글", { selector: "input" });
// 닫힘 = 내용이 inert + 패널이 aria-hidden(보이는 쪽 단서까지 함께 본다).
const isClosed = () =>
  input().closest("[inert]") !== null &&
  input().closest("aside")?.getAttribute("aria-hidden") === "true";
const kpiLink = (label: string) =>
  screen
    .getAllByRole("link")
    .find((a) => a.textContent?.includes(label)) as HTMLElement;
// 마우스 한 번 — InspectorPanel 의 document mousedown 이 click 보다 먼저 닫는다.
const mouseClick = (el: HTMLElement) => {
  fireEvent.mouseDown(el);
  fireEvent.mouseUp(el);
  fireEvent.click(el);
};

beforeEach(() => {
  setUrl("?week=2026-11-16&tab=application");
});
afterEach(cleanup);

describe("KPI 카드는 열린 서랍을 닫는다", () => {
  it("마우스: [쓰기]로 연 서랍 — 합격자 발표 카드를 누르면 닫히고 포커스는 카드에 남는다", () => {
    renderReport();
    const opener = screen.getByRole("button", { name: "프로젝트 쓰기" });
    opener.focus();
    fireEvent.click(opener);
    expect(isClosed()).toBe(false);

    const kpi = kpiLink("합격자 발표");
    kpi.focus();
    mouseClick(kpi);

    expect(isClosed()).toBe(true);
    expect(window.location.search).toContain("tab=pims");
    expect(opener).not.toHaveFocus();
    expect(kpi).toHaveFocus();
  });

  it("키보드(click 만 온다): 같은 결과", () => {
    renderReport();
    const opener = screen.getByRole("button", { name: "프로젝트 쓰기" });
    opener.focus();
    fireEvent.click(opener);
    const kpi = kpiLink("합격자 발표");
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
    mouseClick(kpiLink("운영 중"));
    expect(isClosed()).toBe(true);
    expect(window.location.search).toContain("tab=application");
  });

  it("주소로 연 서랍(tab=project) — 카드를 누르면 주소는 정확히 pims·thisWeek 이고 닫힌다", () => {
    setUrl("?week=2026-11-16&tab=project");
    renderReport();
    expect(isClosed()).toBe(false);
    mouseClick(kpiLink("합격자 발표"));
    expect(window.location.search).toBe(
      "?week=2026-11-16&tab=pims&sub=thisWeek",
    );
    expect(isClosed()).toBe(true);
  });

  it("수정 키 클릭: dismiss 도 안 하고 href 기본 동작도 막지 않는다(새 탭)", () => {
    renderReport();
    fireEvent.click(screen.getByRole("button", { name: "프로젝트 쓰기" }));
    const link = kpiLink("운영 중");
    const notPrevented = fireEvent.click(link, { ctrlKey: true });
    expect(notPrevented).toBe(true);
    expect(isClosed()).toBe(false);
  });

  it("주소가 tab=status 여도(서버는 내 보고서를 그렸다) [쓰기]는 서랍을 연다", () => {
    setUrl("?week=2026-11-16&tab=status");
    renderReport();
    fireEvent.click(screen.getByRole("button", { name: "프로젝트 쓰기" }));
    expect(isClosed()).toBe(false);
  });
});
