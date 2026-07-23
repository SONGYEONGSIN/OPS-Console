"use client";
import { useRef } from "react";

/**
 * 메모 리치 에디터 — contentEditable. 텍스트 입력 + 이미지 붙여넣기(커서 위치에 인라인 삽입).
 * 이미지 위에서 좌우 드래그하면 폭 조절(width 속성 저장). uncontrolled: 초기 HTML만 주입하고
 * 편집 중엔 React가 관여하지 않는다(커서 튐 방지). 저장은 blur/리사이즈 종료 시 innerHTML을 onSave로.
 * 서버(fillUpdateItem)에서 반드시 sanitize된다.
 */
export function RichNote({
  initialHtml,
  onSave,
  onPasteImage,
  placeholder,
}: {
  initialHtml: string;
  onSave: (html: string) => void;
  onPasteImage: (dataUrl: string) => Promise<string | null>;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const save = () => {
    if (ref.current) onSave(ref.current.innerHTML);
  };

  const insertImage = (url: string) => {
    const el = ref.current;
    if (!el) return;
    const img = document.createElement("img");
    img.src = url;
    img.alt = "첨부 이미지";
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(img);
      range.collapse(false);
    } else {
      el.appendChild(img);
    }
    save();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const file = Array.from(e.clipboardData.items)
      .find((it) => it.type.startsWith("image/"))
      ?.getAsFile();
    if (!file) return;
    e.preventDefault();
    const reader = new FileReader();
    reader.onload = async () => {
      const url = await onPasteImage(String(reader.result));
      if (url) insertImage(url);
    };
    reader.readAsDataURL(file);
  };

  // 이미지 위 좌우 드래그 → 폭 조절
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== "IMG") return;
    const img = target as HTMLImageElement;
    e.preventDefault();
    const startX = e.clientX;
    const startW = img.getBoundingClientRect().width;
    const maxW = ref.current ? ref.current.clientWidth - 8 : 800;
    const onMove = (ev: MouseEvent) => {
      const w = Math.min(Math.max(startW + (ev.clientX - startX), 40), maxW);
      img.setAttribute("width", String(Math.round(w)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      save();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      data-placeholder={placeholder ?? "메모 (여러 줄 · 이미지 붙여넣기 가능)"}
      onBlur={save}
      onPaste={onPaste}
      onMouseDown={onMouseDown}
      dangerouslySetInnerHTML={{ __html: initialHtml }}
      className="mt-2 min-h-32 w-full whitespace-pre-wrap border border-line-soft bg-field-bg px-2 py-1.5 text-sm transition-colors focus:border-ink focus:bg-white focus:outline-none [&:empty]:before:text-muted [&:empty]:before:content-[attr(data-placeholder)] [&_img]:my-1 [&_img]:max-w-full [&_img]:cursor-[ew-resize] [&_img]:rounded [&_img]:border [&_img]:border-line-soft"
    />
  );
}
