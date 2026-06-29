import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandoverCategoryFields } from "../HandoverCategoryFields";
import type { ListRow } from "../../../../patterns/ListPattern";

const row: ListRow = {
  id: "service-1",
  name: "서울대학교 · 수시",
  status: "active",
  owner: "송영신",
  universityName: "서울대학교",
  serviceName: "수시 일반전형",
  handoverContractInfo: {
    title: "원서접수",
    type: "수의",
    progress: "운영자",
    status: "완료",
    memo: "",
  },
  handoverWorkBasicMd: null,
};

describe("HandoverCategoryFields", () => {
  it("계약 카테고리 — 계약정보 prefill 노출", () => {
    render(
      <HandoverCategoryFields row={row} setRow={vi.fn()} category="contract" />,
    );
    expect(screen.getByLabelText("형태")).toHaveValue("수의");
    expect(
      screen.getByRole("button", { name: /계약자료/ }),
    ).toBeInTheDocument();
  });

  it("작업 카테고리 — 기초작업 아코디언 헤더 노출, 펼치면 입력", () => {
    render(
      <HandoverCategoryFields row={row} setRow={vi.fn()} category="work" />,
    );
    const header = screen.getByRole("button", { name: /기초작업/ });
    fireEvent.click(header);
    expect(screen.getByLabelText("기초작업")).toBeInTheDocument();
  });

  it("textarea 입력 시 setRow 호출", () => {
    const setRow = vi.fn();
    render(
      <HandoverCategoryFields row={row} setRow={setRow} category="contract" />,
    );
    fireEvent.click(screen.getByRole("button", { name: /계약자료/ }));
    fireEvent.change(screen.getByLabelText("계약자료 메모"), {
      target: { value: "신규자료" },
    });
    expect(setRow).toHaveBeenCalled();
  });
});
