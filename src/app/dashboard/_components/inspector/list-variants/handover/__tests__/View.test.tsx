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
  handoverContractInfo: {
    title: "원서접수",
    type: "수의",
    progress: "운영자",
    status: "완료",
    memo: "※ 학부 계약시 포함",
  },
  handoverWorkBasicMd: "기초작업 내용",
};

describe("HandoverView", () => {
  it("작성상태 색상 — 작성중=빨강 볼드 / 작성완료=세이지 볼드", () => {
    const { rerender } = render(
      <HandoverView row={{ ...row, handoverStatus: "draft" }} />,
    );
    const draft = screen.getByText("작성중");
    expect(draft).toHaveClass("font-bold", "text-vermilion");
    rerender(<HandoverView row={{ ...row, handoverStatus: "ready" }} />);
    expect(screen.getByText("작성완료")).toHaveClass("font-bold", "text-sage");
  });

  it("작성상태 미작성 — 회색", () => {
    render(<HandoverView row={{ ...row, handoverStatus: undefined }} />);
    expect(screen.getByText("미작성")).toHaveClass("text-muted");
  });

  it("기본정보 — 학교명·서비스·접수구분 표시", () => {
    render(<HandoverView row={row} />);
    expect(screen.getByText("가야대학교")).toBeInTheDocument();
    expect(screen.getByText("수시모집")).toBeInTheDocument();
    expect(screen.getByText("4년제")).toBeInTheDocument();
  });

  it("기본 계약 카테고리 → 계약정보 구조화 폼 readonly + 값", () => {
    render(<HandoverView row={row} />);
    expect(screen.getByText("원서접수")).toBeInTheDocument();
    expect(screen.getByText("수의")).toBeInTheDocument();
    expect(screen.getByText("운영자")).toBeInTheDocument();
    expect(screen.getByText("완료")).toBeInTheDocument();
    expect(screen.queryByLabelText("형태")).toBeNull();
  });

  it("카테고리 탭(작업) 클릭 시 다른 필드 표시", () => {
    render(<HandoverView row={row} />);
    fireEvent.click(screen.getByRole("button", { name: "작업" }));
    const ta = screen.getByLabelText("기초작업") as HTMLTextAreaElement;
    expect(ta.value).toBe("기초작업 내용");
  });

  it("계약정보 값 없으면 — 로 표시", () => {
    render(
      <HandoverView row={{ ...row, handoverContractInfo: undefined }} />,
    );
    // 빈 폼은 각 필드를 '—'로 표시
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("계약자료 — 계약서류 체크리스트 렌더", () => {
    render(
      <HandoverView
        row={{
          ...row,
          handoverContractChecklist: [
            { id: "x", text: "계약서", done: true },
          ],
        }}
      />,
    );
    expect(screen.getByText("계약서류")).toBeInTheDocument();
    expect(screen.getByText("계약서")).toBeInTheDocument();
  });
});
