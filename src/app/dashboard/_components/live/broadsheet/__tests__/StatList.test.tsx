import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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

  it("href 없는 row는 클릭 버튼이 아니다", () => {
    render(<StatList rows={rows} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("href 있는 row 클릭 시 모달에 상세 리스트 + 이동버튼을 표시한다", () => {
    const clickable: StatRow[] = [
      {
        label: "오픈예정",
        value: "90",
        href: "/dashboard/closing",
        detailRows: [{ time: "06.16", title: "단국대 · 일반대학원" }],
      },
    ];
    render(<StatList rows={clickable} />);
    fireEvent.click(screen.getByRole("button", { name: /오픈예정/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("단국대 · 일반대학원")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /페이지 이동하기/ });
    expect(link).toHaveAttribute("href", "/dashboard/closing");
  });
});
