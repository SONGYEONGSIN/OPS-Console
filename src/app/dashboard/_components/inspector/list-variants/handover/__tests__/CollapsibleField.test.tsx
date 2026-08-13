import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CollapsibleField } from "../CollapsibleField";
import { BADGE_TONE } from "../../badge-tone";

describe("CollapsibleField", () => {
  it("배지 색이 공통 규칙을 따른다", () => {
    const { rerender } = render(
      <CollapsibleField label="출력물" filled>
        <p>본문</p>
      </CollapsibleField>,
    );
    expect(screen.getByText("작성완료")).toHaveClass(
      ...BADGE_TONE.done.split(" "),
    );
    rerender(
      <CollapsibleField label="출력물" filled={false}>
        <p>본문</p>
      </CollapsibleField>,
    );
    // 미작성은 '아직 안 한 상태'라 대기(그레이) — 장애·실패 같은 주의 색이 아니다.
    expect(screen.getByText("미작성")).toHaveClass(
      ...BADGE_TONE.idle.split(" "),
    );
  });

  it("defaultOpen=false면 본문 숨김, 헤더 클릭 시 펼침", () => {
    render(
      <CollapsibleField label="출력물" filled={false}>
        <p>본문내용</p>
      </CollapsibleField>,
    );
    expect(screen.queryByText("본문내용")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /출력물/ }));
    expect(screen.getByText("본문내용")).toBeInTheDocument();
  });

  it("defaultOpen=true면 본문 표시", () => {
    render(
      <CollapsibleField label="기초작업" filled defaultOpen>
        <p>본문내용</p>
      </CollapsibleField>,
    );
    expect(screen.getByText("본문내용")).toBeInTheDocument();
  });

  it("미작성(filled=false)이면 헤더에 '미작성' 배지", () => {
    render(
      <CollapsibleField label="경쟁률" filled={false}>
        <p>x</p>
      </CollapsibleField>,
    );
    expect(screen.getByText("미작성")).toBeInTheDocument();
    expect(screen.queryByText("작성완료")).toBeNull();
  });

  it("작성됨(filled=true)이면 헤더에 '작성완료' 배지", () => {
    render(
      <CollapsibleField label="기초작업" filled>
        <p>x</p>
      </CollapsibleField>,
    );
    expect(screen.getByText("작성완료")).toBeInTheDocument();
    expect(screen.queryByText("미작성")).toBeNull();
  });
});
