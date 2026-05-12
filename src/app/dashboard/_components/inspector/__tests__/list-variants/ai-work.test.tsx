import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ListRow } from "../../../patterns/ListPattern";
import { AiWorkView } from "../../list-variants/ai-work/View";
import { AiWorkForm } from "../../list-variants/ai-work/EditForm";

const baseRow: ListRow = {
  id: "aiw-001",
  name: "회의록 요약 자동화",
  status: "active",
  owner: "송영석",
  workDate: "2026-05-12",
  aiTool: "claude",
  category: "meeting",
  summary: "주간 회의록 30분 → 5분 자동 요약",
  savedHours: 0.5,
  tags: ["회의록", "주간"],
};

describe("AiWorkView", () => {
  it("메타 — 작업일/도구/카테고리/등록자/절감 시간 표시", () => {
    render(<AiWorkView row={baseRow} />);
    expect(screen.getByText("2026-05-12")).toBeInTheDocument();
    expect(screen.getByText("송영석")).toBeInTheDocument();
    expect(screen.getByText("0.5 시간")).toBeInTheDocument();
  });

  it("요약 — summary 표시", () => {
    render(<AiWorkView row={baseRow} />);
    expect(
      screen.getByText("주간 회의록 30분 → 5분 자동 요약"),
    ).toBeInTheDocument();
  });

  it("결과물 링크 — outputUrl 있을 때만 노출", () => {
    render(
      <AiWorkView
        row={{ ...baseRow, outputUrl: "https://notion.so/abc" }}
      />,
    );
    expect(screen.getByText("https://notion.so/abc")).toBeInTheDocument();
  });

  it("재사용 프롬프트 — 복사 버튼 노출", () => {
    render(
      <AiWorkView
        row={{ ...baseRow, reusePrompt: "회의록을 요약해주세요" }}
      />,
    );
    expect(
      screen.getByRole("button", { name: "프롬프트 복사" }),
    ).toBeInTheDocument();
  });

  it("태그 — 모든 태그 표시", () => {
    render(<AiWorkView row={baseRow} />);
    expect(screen.getByText("회의록")).toBeInTheDocument();
    expect(screen.getByText("주간")).toBeInTheDocument();
  });

  it("summary 미존재 — 안내 표시", () => {
    render(<AiWorkView row={{ ...baseRow, summary: undefined }} />);
    expect(screen.getByText("요약 없음")).toBeInTheDocument();
  });
});

describe("AiWorkForm", () => {
  it("필드 — 제목/작업일자/AI 도구/카테고리/요약/결과물/재사용 프롬프트/절감 시간/태그", () => {
    render(
      <AiWorkForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("제목")).toHaveValue("회의록 요약 자동화");
    expect(screen.getByLabelText("작업 일자")).toHaveValue("2026-05-12");
    expect(screen.getByLabelText("AI 도구")).toHaveValue("claude");
    expect(screen.getByLabelText("카테고리")).toHaveValue("meeting");
    expect(screen.getByLabelText("요약")).toHaveValue(
      "주간 회의록 30분 → 5분 자동 요약",
    );
    expect(screen.getByLabelText("절감 시간")).toHaveValue(0.5);
    expect(screen.getByLabelText("태그")).toHaveValue("회의록, 주간");
  });

  it("등록자 — owner 있을 때 본인 자동 입력 라벨", () => {
    render(
      <AiWorkForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/본인 자동 입력/)).toBeInTheDocument();
  });

  it("저장 — onSave 호출", () => {
    const onSave = vi.fn();
    render(
      <AiWorkForm
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
      <AiWorkForm
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
