import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandoverView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";

const row: ListRow = {
  id: "service-1",
  name: "가야대학교 · 수시모집",
  status: "active",
  owner: "송영신",
  universityName: "가야대학교",
  serviceName: "수시모집",
  universityType: "4년제",
  applicationType: "수시모집",
  handoverContractInfoMd: "계약정보 내용",
  handoverWorkBasicMd: "기초작업 내용",
};

describe("HandoverView", () => {
  it("기본정보 — 학교명·서비스·접수구분 표시", () => {
    render(<HandoverView row={row} />);
    expect(screen.getByText("가야대학교")).toBeInTheDocument();
    expect(screen.getByText("수시모집")).toBeInTheDocument();
    expect(screen.getByText("4년제")).toBeInTheDocument();
  });

  it("기본 계약 카테고리 → 계약정보 textarea readonly + 값", () => {
    render(<HandoverView row={row} />);
    const ta = screen.getByLabelText("계약정보") as HTMLTextAreaElement;
    expect(ta).toHaveAttribute("readonly");
    expect(ta.value).toBe("계약정보 내용");
  });

  it("카테고리 탭(작업) 클릭 시 다른 필드 표시", () => {
    render(<HandoverView row={row} />);
    fireEvent.click(screen.getByRole("button", { name: "작업" }));
    const ta = screen.getByLabelText("기초작업") as HTMLTextAreaElement;
    expect(ta.value).toBe("기초작업 내용");
  });

  it("값 없으면 예시(부산대 일반편입학)를 placeholder로 표시", () => {
    render(<HandoverView row={{ ...row, handoverContractDataMd: null }} />);
    const ta = screen.getByLabelText("계약자료") as HTMLTextAreaElement;
    expect(ta.value).toBe("");
    expect(ta.placeholder).toContain("수시, 정시만");
  });
});
