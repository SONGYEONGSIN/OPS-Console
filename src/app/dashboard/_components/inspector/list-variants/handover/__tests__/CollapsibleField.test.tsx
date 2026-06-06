import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CollapsibleField } from "../CollapsibleField";

describe("CollapsibleField", () => {
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
