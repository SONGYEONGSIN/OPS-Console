import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SideBox } from "../SideBox";

describe("SideBox", () => {
  it("title + children 렌더", () => {
    render(
      <SideBox title="시스템 게이트웨이 상태">
        <div>본문 콘텐츠</div>
      </SideBox>
    );
    expect(screen.getByText("시스템 게이트웨이 상태")).toBeInTheDocument();
    expect(screen.getByText("본문 콘텐츠")).toBeInTheDocument();
  });
  it("titleRight slot 렌더", () => {
    const { container } = render(
      <SideBox title="x" titleRight={<span data-tr>R</span>}>
        <div />
      </SideBox>
    );
    expect(container.querySelector("[data-tr]")).not.toBeNull();
  });
  it("titleRight 없으면 우측 슬롯 비어있음", () => {
    const { container } = render(<SideBox title="x"><div /></SideBox>);
    expect(container.querySelector("[data-tr]")).toBeNull();
  });
  it("className prop으로 외부 스타일 주입", () => {
    const { container } = render(
      <SideBox title="x" className="min-h-[320px] custom-test">
        <div />
      </SideBox>
    );
    expect((container.firstChild as HTMLElement).className).toMatch(/min-h-\[320px\]/);
    expect((container.firstChild as HTMLElement).className).toMatch(/custom-test/);
  });
});
