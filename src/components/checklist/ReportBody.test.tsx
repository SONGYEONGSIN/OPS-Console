import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportBody } from "./ReportBody";

describe("ReportBody", () => {
  it("h3 카테고리 앞에 SVG 구분자를 주입한다", () => {
    const { container } = render(
      <ReportBody html="<h3>결제사</h3><p>본문</p>" />,
    );
    expect(container.querySelector("h3 svg")).toBeTruthy();
    expect(screen.getByText("결제사")).toBeTruthy();
  });

  it("제목·표 내용을 렌더한다", () => {
    render(
      <ReportBody html="<h2>요약</h2><table><tbody><tr><td>셀값</td></tr></tbody></table>" />,
    );
    expect(screen.getByText("요약")).toBeTruthy();
    expect(screen.getByText("셀값")).toBeTruthy();
  });
});
