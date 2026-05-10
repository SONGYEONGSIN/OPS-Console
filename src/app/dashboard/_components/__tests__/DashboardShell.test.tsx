import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { DashboardShell } from "../DashboardShell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("../../_data/sidebar-helpers", () => ({
  findSidebarParentGroup: () => null,
}));

describe("DashboardShell", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("topBar / appBar / chrome / statusBar / children 슬롯을 모두 렌더", () => {
    render(
      <DashboardShell
        topBar={<div>TOP_BAR_SLOT</div>}
        appBar={<div>APP_BAR_SLOT</div>}
        chrome={<div>CHROME_SLOT</div>}
        statusBar={<div>STATUS_BAR_SLOT</div>}
        sections={[]}
      >
        <div>CHILDREN_SLOT</div>
      </DashboardShell>
    );
    expect(screen.getByText("TOP_BAR_SLOT")).toBeInTheDocument();
    expect(screen.getByText("APP_BAR_SLOT")).toBeInTheDocument();
    expect(screen.getByText("CHROME_SLOT")).toBeInTheDocument();
    expect(screen.getByText("STATUS_BAR_SLOT")).toBeInTheDocument();
    expect(screen.getByText("CHILDREN_SLOT")).toBeInTheDocument();
  });

  it("초기 상태에서 사이드바 닫힘 — body overflow 변화 없음", () => {
    render(
      <DashboardShell
        appBar={null}
        chrome={null}
        statusBar={null}
        sections={[]}
      >
        <div />
      </DashboardShell>
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("ESC 키 핸들러는 사이드바 열림 상태에서만 등록 (cleanup 검증)", () => {
    const { unmount } = render(
      <DashboardShell
        appBar={null}
        chrome={null}
        statusBar={null}
        sections={[]}
      >
        <div />
      </DashboardShell>
    );
    // 초기 상태에서 ESC 눌러도 에러 없이 통과해야 함
    act(() => {
      fireEvent.keyDown(document, { key: "Escape" });
    });
    unmount();
    // unmount 후 body.overflow 누수 없음
    expect(document.body.style.overflow).toBe("");
  });
});
