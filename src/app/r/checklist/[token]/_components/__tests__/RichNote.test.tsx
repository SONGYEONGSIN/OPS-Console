import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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

  it("저장 뒤 서버가 새 HTML(새 서명 주소)을 내려도 편집 중인 내용을 덮어쓰지 않는다", () => {
    const { rerender } = render(
      <RichNote
        initialHtml='<img src="https://x/a.png?token=1">'
        onSave={() => {}}
        onPasteImage={async () => null}
      />,
    );
    const box = screen.getByRole("textbox");
    box.innerHTML = "";
    rerender(
      <RichNote
        initialHtml='<img src="https://x/a.png?token=2">'
        onSave={() => {}}
        onPasteImage={async () => null}
      />,
    );
    expect(box.querySelector("img")).toBeNull();
  });

  it("그림을 끌지 않고 누르면 그 그림이 선택된다 — Delete/Backspace 로 지울 수 있게", () => {
    render(
      <RichNote
        initialHtml='<p>앞</p><img src="https://x/a.png" alt="첨부 이미지">'
        onSave={() => {}}
        onPasteImage={async () => null}
      />,
    );
    const img = screen.getByAltText("첨부 이미지");
    fireEvent.mouseDown(img, { clientX: 10 });
    fireEvent.mouseUp(window, { clientX: 10 });
    const range = window.getSelection()?.getRangeAt(0);
    expect(range?.startContainer).toBe(img.parentNode);
    expect(range?.cloneContents().querySelector("img")).not.toBeNull();
  });

  it("그림을 누르면 크기 버튼이 뜨고, 고르면 편집 칸 폭 기준으로 줄여 저장한다", () => {
    const onSave = vi.fn();
    render(
      <RichNote
        initialHtml='<img src="https://x/a.png" alt="첨부 이미지">'
        onSave={onSave}
        onPasteImage={async () => null}
      />,
    );
    const box = screen.getByRole("textbox");
    Object.defineProperty(box, "clientWidth", { value: 808, configurable: true });
    expect(screen.queryByRole("group", { name: "그림 크기" })).toBeNull();
    const img = screen.getByAltText("첨부 이미지");
    fireEvent.mouseDown(img, { clientX: 10 });
    fireEvent.mouseUp(window, { clientX: 10 });
    const bar = screen.getByRole("group", { name: "그림 크기" });
    fireEvent.click(within(bar).getByRole("button", { name: "중간" }));
    expect(img.getAttribute("width")).toBe("400");
    expect(onSave).toHaveBeenLastCalledWith(expect.stringContaining('width="400"'));
    fireEvent.click(within(bar).getByRole("button", { name: "원래대로" }));
    expect(img.hasAttribute("width")).toBe(false);
  });

  it("그림 밖을 누르면 크기 버튼이 사라진다", () => {
    render(
      <RichNote
        initialHtml='<p>글</p><img src="https://x/a.png" alt="첨부 이미지">'
        onSave={() => {}}
        onPasteImage={async () => null}
      />,
    );
    const img = screen.getByAltText("첨부 이미지");
    fireEvent.mouseDown(img, { clientX: 10 });
    fireEvent.mouseUp(window, { clientX: 10 });
    expect(screen.getByRole("group", { name: "그림 크기" })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByText("글"));
    expect(screen.queryByRole("group", { name: "그림 크기" })).toBeNull();
  });
});
