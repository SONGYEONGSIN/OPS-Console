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
    expect(screen.getByText(/진행 2\/14/)).toBeInTheDocument();
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
