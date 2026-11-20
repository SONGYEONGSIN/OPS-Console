import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock(
  "next/navigation",
  async () => (await import("./search-params-mock")).navigationModule,
);

import { ProjectDrawer } from "../_components/ProjectDrawer";
import {
  ProjectDrawerProvider,
  useProjectDrawer,
} from "../_components/project-drawer-context";
import { setUrl } from "./search-params-mock";

afterEach(cleanup);

const panels = {
  project: <input aria-label="프로젝트 글" />,
  tf: <input aria-label="TF 글" />,
};

function Opener({ kind }: { kind: "project" | "tf" }) {
  const { open } = useProjectDrawer();
  return (
    <button
      type="button"
      onClick={() => {
        open(kind);
      }}
    >
      열기
    </button>
  );
}

function renderDrawer(opener?: "project" | "tf") {
  return render(
    <ProjectDrawerProvider>
      {opener ? <Opener kind={opener} /> : null}
      <ProjectDrawer panels={panels} />
    </ProjectDrawerProvider>,
  );
}

describe("ProjectDrawer", () => {
  it("tab=tf 로 들어오면 TF 서랍이 열린 채 시작한다", () => {
    setUrl("?week=2026-11-16&tab=tf");
    renderDrawer();
    expect(
      screen.getByRole("heading", { name: "TF" }).closest("aside"),
    ).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByLabelText("TF 글").closest("[hidden]")).toBeNull();
    expect(screen.getByLabelText("프로젝트 글", { selector: "input" }).closest("[hidden]")).not.toBeNull();
  });

  it("넓은 서랍 — md:w-[min(48rem,100vw)]", () => {
    setUrl("?week=2026-11-16&tab=project");
    renderDrawer();
    const aside = screen.getByRole("heading", { name: "프로젝트" }).closest("aside");
    expect(aside?.className.split(/\s+/)).toContain("md:w-[min(48rem,100vw)]");
  });

  it("RF3 닫힌 서랍의 내용은 마운트돼 있지만 inert 다 — 머리 줄의 [닫기]까지", () => {
    setUrl("?week=2026-11-16&tab=application");
    renderDrawer();
    expect(screen.getByLabelText("프로젝트 글").closest("[inert]")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "닫기", hidden: true }).closest("[inert]"),
    ).not.toBeNull();
  });

  it("열려 있으면 inert 가 없고 [닫기] 는 터치 크기 클래스를 가진다", () => {
    setUrl("?week=2026-11-16&tab=project");
    renderDrawer();
    const close = screen.getByRole("button", { name: "닫기" });
    expect(close.closest("[inert]")).toBeNull();
    expect(close.className.split(/\s+/)).toContain("min-h-9");
  });

  it("RF2 닫았다 다시 열어도 쓰던 글이 남고, tab=project 로 연 서랍을 닫으면 주소는 application", () => {
    setUrl("?week=2026-11-16&tab=project");
    renderDrawer();
    fireEvent.change(screen.getByLabelText("프로젝트 글"), {
      target: { value: "쓰던 글" },
    });
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(window.location.search).toBe("?week=2026-11-16&tab=application");
    expect(screen.getByLabelText("프로젝트 글")).toHaveValue("쓰던 글");
  });

  it("[쓰기]로 열면 주소는 그대로(왼쪽 영역을 잃지 않는다), 닫아도 주소는 그대로", () => {
    setUrl("?week=2026-11-16&tab=pims");
    renderDrawer("tf");
    fireEvent.click(screen.getByRole("button", { name: "열기" }));
    expect(window.location.search).toBe("?week=2026-11-16&tab=pims");
    expect(
      screen.getByRole("heading", { name: "TF" }).closest("aside"),
    ).toHaveAttribute("aria-hidden", "false");
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(window.location.search).toBe("?week=2026-11-16&tab=pims");
    expect(
      screen.getByRole("button", { name: "닫기", hidden: true }).closest("aside"),
    ).toHaveAttribute("aria-hidden", "true");
  });
});
