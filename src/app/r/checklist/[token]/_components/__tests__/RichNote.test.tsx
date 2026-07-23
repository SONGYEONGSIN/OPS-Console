import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RichNote } from "../RichNote";

describe("RichNote (메모 리치 에디터)", () => {
  it("초기 HTML을 렌더한다", () => {
    render(
      <RichNote
        initialHtml="<div>안녕</div>"
        onSave={() => {}}
        onPasteImage={async () => null}
      />,
    );
    expect(screen.getByText("안녕")).toBeInTheDocument();
  });

  it("contentEditable 텍스트박스로 렌더된다", () => {
    render(
      <RichNote
        initialHtml=""
        onSave={() => {}}
        onPasteImage={async () => null}
      />,
    );
    const box = screen.getByRole("textbox");
    expect(box).toHaveAttribute("contenteditable", "true");
  });

  it("blur 시 innerHTML을 onSave로 넘긴다", () => {
    const onSave = vi.fn();
    render(
      <RichNote
        initialHtml="<div>메모내용</div>"
        onSave={onSave}
        onPasteImage={async () => null}
      />,
    );
    fireEvent.blur(screen.getByRole("textbox"));
    expect(onSave).toHaveBeenCalledWith("<div>메모내용</div>");
  });
});
