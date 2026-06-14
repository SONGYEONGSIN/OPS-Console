import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { StatList, type StatRow } from "../StatList";

describe("StatList", () => {
  const rows: StatRow[] = [
    { label: "진행 중", value: "12" },
    { label: "미처리 사고", value: "3", tone: "vermilion" },
    { label: "정상", value: "8", tone: "sage" },
  ];

  it("각 row의 label과 value 텍스트를 렌더한다", () => {
    render(<StatList rows={rows} />);
    expect(screen.getByText("진행 중")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("미처리 사고")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("정상")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
  });

  it("tone='vermilion'이면 라벨에 text-vermilion 클래스를 적용한다", () => {
    render(<StatList rows={rows} />);
    const label = screen.getByText("미처리 사고");
    expect(label.className).toContain("text-vermilion");
  });

  it("tone='sage'이면 값에 text-sage 클래스를 적용한다", () => {
    render(<StatList rows={rows} />);
    const value = screen.getByText("8");
    expect(value.className).toContain("text-sage");
  });

  it("tone 미지정이면 라벨 text-muted, 값 text-ink를 적용한다", () => {
    render(<StatList rows={rows} />);
    const label = screen.getByText("진행 중");
    const value = screen.getByText("12");
    expect(label.className).toContain("text-muted");
    expect(value.className).toContain("text-ink");
  });
});
