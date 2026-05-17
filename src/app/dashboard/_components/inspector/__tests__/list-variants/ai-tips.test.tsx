import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ListRow } from "../../../patterns/ListPattern";
import { AiTipsView } from "../../list-variants/ai-tips/View";
import { AiTipsForm } from "../../list-variants/ai-tips/EditForm";

const baseRow: ListRow = {
  id: "tip-001",
  name: "회의록 5문장 요약 프롬프트",
  status: "active",
  owner: "송영석",
  aiTool: "chatgpt",
  category: "meeting",
  summary: "주간 회의록을 5문장으로 요약. 결정사항 + 액션 분리.",
  reusePrompt: "다음 회의록을 5문장으로 요약해줘.",
  tags: ["회의록", "주간"],
};

describe("AiTipsView", () => {
  it("메타 — 도구/카테고리/등록자 표시", () => {
    render(<AiTipsView row={baseRow} />);
    expect(screen.getByText("ChatGPT")).toBeInTheDocument();
    expect(screen.getByText("회의")).toBeInTheDocument();
    expect(screen.getByText("송영석")).toBeInTheDocument();
  });

  it("요약 표시", () => {
    render(<AiTipsView row={baseRow} />);
    expect(
      screen.getByText(/주간 회의록을 5문장으로 요약/),
    ).toBeInTheDocument();
  });

  it("재사용 프롬프트 — 본문 + 복사 버튼", () => {
    render(<AiTipsView row={baseRow} />);
    expect(
      screen.getByText("다음 회의록을 5문장으로 요약해줘."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /프롬프트.*복사/ }),
    ).toBeInTheDocument();
  });

  it("태그 모두 노출", () => {
    render(<AiTipsView row={baseRow} />);
    expect(screen.getByText("회의록")).toBeInTheDocument();
    expect(screen.getByText("주간")).toBeInTheDocument();
  });
});

describe("AiTipsForm", () => {
  it("필드 — 제목/도구/카테고리/요약/재사용 프롬프트/태그", () => {
    render(
      <AiTipsForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("제목")).toHaveValue(
      "회의록 5문장 요약 프롬프트",
    );
    expect(screen.getByLabelText("AI 도구")).toHaveValue("chatgpt");
    expect(screen.getByLabelText("카테고리")).toHaveValue("meeting");
    expect(screen.getByLabelText("재사용 프롬프트")).toHaveValue(
      "다음 회의록을 5문장으로 요약해줘.",
    );
    expect(screen.getByLabelText("태그")).toHaveValue("회의록, 주간");
  });

  it("재사용 프롬프트는 required (HTML 속성)", () => {
    render(
      <AiTipsForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("재사용 프롬프트")).toBeRequired();
  });

  it("저장 — onSave 호출", () => {
    const onSave = vi.fn();
    render(
      <AiTipsForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith(baseRow);
  });

  it("취소 — onCancel 호출", () => {
    const onCancel = vi.fn();
    render(
      <AiTipsForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
