import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock(
  "next/navigation",
  async () => (await import("./search-params-mock")).navigationModule,
);

import { AreaTabs } from "../_components/AreaTabs";
import { setUrl } from "./search-params-mock";

afterEach(cleanup);

describe("AreaTabs", () => {
  it("라벨 — 원서접수 / 합격자 발표 / 휴가·외근, 확인한 영역은 ✓", () => {
    setUrl("?week=2026-11-16&tab=application");
    render(<AreaTabs checked={["pims"]} />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "원서접수",
      "합격자 발표 ✓",
      "휴가·외근",
    ]);
  });
  it("영역을 고르면 tab 만 바꾸고 sub 는 지운다(서버 왕복 없음)", () => {
    setUrl("?week=2026-11-16&tab=application&sub=running");
    render(<AreaTabs checked={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "합격자 발표" }));
    expect(window.location.search).toBe("?week=2026-11-16&tab=pims");
    expect(screen.getByRole("tab", { name: "합격자 발표" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
  it("지금 영역을 다시 누르면 주소를 건드리지 않는다", () => {
    setUrl("?week=2026-11-16&tab=application&sub=running");
    render(<AreaTabs checked={[]} />);
    fireEvent.click(screen.getByRole("tab", { name: "원서접수" }));
    expect(window.location.search).toBe(
      "?week=2026-11-16&tab=application&sub=running",
    );
  });
  it("tab=project·tf 로 들어오면 원서접수가 선택돼 있다", () => {
    setUrl("?week=2026-11-16&tab=tf");
    render(<AreaTabs checked={[]} />);
    expect(screen.getByRole("tab", { name: "원서접수" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
  it("모양 — 선택은 목록 선택 표준, 나머지는 hover:bg-line-soft", () => {
    setUrl("?week=2026-11-16&tab=leave");
    render(<AreaTabs checked={[]} />);
    const on = screen
      .getByRole("tab", { name: "휴가·외근" })
      .className.split(/\s+/);
    expect(on).toEqual(
      expect.arrayContaining([
        "border-vermilion",
        "bg-vermilion/10",
        "text-vermilion",
      ]),
    );
    expect(
      screen.getByRole("tab", { name: "원서접수" }).className.split(/\s+/),
    ).toContain("hover:bg-line-soft");
  });
  it("roving tabIndex — 선택만 0", () => {
    setUrl("?week=2026-11-16&tab=pims");
    render(<AreaTabs checked={[]} />);
    expect(
      screen.getAllByRole("tab").map((t) => t.getAttribute("tabindex")),
    ).toEqual(["-1", "0", "-1"]);
  });
  it("→ 키로 다음 영역, 포커스도 따라간다", () => {
    setUrl("?week=2026-11-16&tab=application");
    render(<AreaTabs checked={[]} />);
    fireEvent.keyDown(screen.getByRole("tab", { name: "원서접수" }), {
      key: "ArrowRight",
    });
    expect(window.location.search).toContain("tab=pims");
    expect(screen.getByRole("tab", { name: "합격자 발표" })).toHaveFocus();
  });
});
