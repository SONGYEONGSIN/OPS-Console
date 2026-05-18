import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandoverView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";

const row: ListRow = {
  id: "service-1",
  name: "서울대 · 수시",
  status: "active",
  owner: "송영신",
  handoverContractInfoMd: "계약정보 내용",
  handoverWorkBasicMd: "기초작업 내용",
};

describe("HandoverView", () => {
  it("기본 계약 카테고리 → 계약정보/계약자료 textarea readonly + 값", () => {
    render(<HandoverView row={row} />);
    const ta = screen.getByLabelText("계약정보") as HTMLTextAreaElement;
    expect(ta).toHaveAttribute("readonly");
    expect(ta.value).toBe("계약정보 내용");
  });

  it("카테고리 select 변경 시 다른 필드 표시", () => {
    render(<HandoverView row={row} />);
    fireEvent.change(screen.getByLabelText("카테고리"), {
      target: { value: "work" },
    });
    const ta = screen.getByLabelText("기초작업") as HTMLTextAreaElement;
    expect(ta.value).toBe("기초작업 내용");
  });

  it("값 없으면 '미작성' placeholder 표시", () => {
    render(<HandoverView row={{ ...row, handoverContractDataMd: null }} />);
    const ta = screen.getByLabelText("계약자료") as HTMLTextAreaElement;
    expect(ta.value).toBe("");
    expect(ta.placeholder).toBe("미작성");
  });
});
