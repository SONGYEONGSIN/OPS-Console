import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
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

  it("닫힌 동안 스크롤 칸은 overflow-hidden 이라 보이지 않는 탭 정지가 못 된다", () => {
    setUrl("?week=2026-11-16&tab=application");
    renderDrawer();
    const body = screen.getByRole("heading", { name: "프로젝트", hidden: true })
      .closest("aside")?.firstElementChild as Element;
    const t = body.className.split(/\s+/);
    expect(t).toEqual(expect.arrayContaining(["h-full", "overflow-hidden", "p-5"]));
    expect(t).not.toContain("overflow-y-auto");
  });

  it("열려 있으면 스크롤 칸은 기본 클래스(overflow-y-auto)", () => {
    setUrl("?week=2026-11-16&tab=project");
    renderDrawer();
    const body = screen.getByRole("heading", { name: "프로젝트" })
      .closest("aside")?.firstElementChild as Element;
    expect(body.className.split(/\s+/)).toContain("overflow-y-auto");
  });

  it("[열기]로 열면 포커스가 서랍 안으로 가고, [닫기]·Esc 로 닫으면 연 버튼으로 돌아온다", () => {
    setUrl("?week=2026-11-16&tab=pims");
    renderDrawer("tf");
    const opener = screen.getByRole("button", { name: "열기" });
    opener.focus();
    fireEvent.click(opener);
    const aside = screen.getByRole("heading", { name: "TF" }).closest("aside");
    expect(aside?.contains(document.activeElement)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(opener).toHaveFocus();

    opener.focus();
    fireEvent.click(opener);
    expect(aside?.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(opener).toHaveFocus();
  });

  it("연 버튼이 DOM 에서 사라졌으면 포커스를 옮기려 들지 않는다", () => {
    setUrl("?week=2026-11-16&tab=pims");
    function Vanishing() {
      const { open } = useProjectDrawer();
      const [gone, setGone] = useState(false);
      return (
        <>
          {gone ? null : (
            <button type="button" onClick={() => { open("tf"); }}>
              열기
            </button>
          )}
          <button type="button" onClick={() => { setGone(true); }}>
            치우기
          </button>
        </>
      );
    }
    render(
      <ProjectDrawerProvider>
        <Vanishing />
        <ProjectDrawer panels={panels} />
      </ProjectDrawerProvider>,
    );
    const opener = screen.getByRole("button", { name: "열기" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "치우기", hidden: true }));
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "닫기" })),
    ).not.toThrow();
    expect(screen.queryByRole("button", { name: "열기" })).toBeNull();
  });
});
