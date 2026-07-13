import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandoverCategoryRail } from "../HandoverCategoryRail";
import type { ListRow } from "@/app/dashboard/_components/patterns/ListPattern";

const row: ListRow = {
  id: "service-1",
  name: "서울대 · 수시",
  status: "active",
  owner: "송영신",
  handoverContractInfo: {
    title: "원서접수",
    type: "",
    progress: "",
    status: "",
    memo: "",
  },
  handoverContractChecklist: [{ id: "a", text: "항목", done: false }],
};

describe("HandoverCategoryRail", () => {
  it("6개 카테고리 라벨 노출", () => {
    render(
      <HandoverCategoryRail row={row} active="contract" onChange={vi.fn()} />,
    );
    for (const label of ["계약", "작업", "정산", "컨텍", "서류", "기타"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(label) }),
      ).toBeInTheDocument();
    }
  });

  it("계약 카테고리 진행도 2/2 표시", () => {
    render(
      <HandoverCategoryRail row={row} active="contract" onChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /계약/ })).toHaveTextContent(
      "2/2",
    );
  });

  it("전체 진행도 표시 (14필드 중 채운 수)", () => {
    render(
      <HandoverCategoryRail row={row} active="contract" onChange={vi.fn()} />,
    );
    expect(screen.getByText(/현재 2\/14 작성완료/)).toBeInTheDocument();
  });

  it("선택/호버가 운영가이드 nav 표준 — vermilion 선택, line-soft 호버 (#846)", () => {
    render(
      <HandoverCategoryRail row={row} active="contract" onChange={vi.fn()} />,
    );
    const active = screen.getByRole("button", { name: /계약/ });
    expect(active.className).toMatch(/border-vermilion/);
    expect(active.className).toMatch(/bg-vermilion\/10/);
    expect(active.className).toMatch(/text-vermilion/);
    expect(active.className).not.toMatch(/bg-ink/);
    const inactive = screen.getByRole("button", { name: /작업/ });
    expect(inactive.className).toMatch(/hover:bg-line-soft/);
  });

  it("운영가이드 nav 구조 — aria-label + 라벨/진행 2줄 항목", () => {
    render(
      <HandoverCategoryRail row={row} active="contract" onChange={vi.fn()} />,
    );
    expect(
      screen.getByRole("navigation", { name: "인수인계 카테고리" }),
    ).toBeInTheDocument();
    // 항목 2줄째 — 진행 desc
    expect(screen.getByText("2/2 작성")).toBeInTheDocument();
  });

  it("카테고리 클릭 시 onChange(key) 호출", () => {
    const onChange = vi.fn();
    render(
      <HandoverCategoryRail row={row} active="contract" onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /작업/ }));
    expect(onChange).toHaveBeenCalledWith("work");
  });
});
