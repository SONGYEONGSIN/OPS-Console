import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ManualList } from "../ManualList";
import type { ManualRow } from "@/features/manuals/schemas";

function file(over: Partial<ManualRow> = {}): ManualRow {
  return {
    id: "F1",
    name: "A01. 원서접수 매뉴얼.docx",
    kind: "file",
    webUrl: "https://example.sharepoint.com/A01.docx",
    parentItemId: "ROOT",
    category: "A",
    size: 836096,
    lastModifiedDateTime: "2026-05-20T14:33:00Z",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ...over,
  };
}

function folder(over: Partial<ManualRow> = {}): ManualRow {
  return {
    id: "FOL1",
    name: "외부 배포 매뉴얼",
    kind: "folder",
    webUrl: "https://example.sharepoint.com/folder",
    parentItemId: "ROOT",
    category: null,
    size: null,
    lastModifiedDateTime: "2026-05-15T09:00:00Z",
    mimeType: null,
    ...over,
  };
}

describe("ManualList", () => {
  it("헤더 카테고리 이름 + hint 표시", () => {
    render(
      <ManualList
        heading="A — 원서접수"
        hint="2개 매뉴얼"
        rows={[file({ id: "F1" }), file({ id: "F2", name: "ABC.docx" })]}
      />,
    );
    expect(screen.getByText("A — 원서접수")).toBeInTheDocument();
    expect(screen.getByText("2개 매뉴얼")).toBeInTheDocument();
  });

  it("빈 rows → '이 카테고리에 매뉴얼 없음'", () => {
    render(<ManualList heading="A" rows={[]} />);
    expect(screen.getByText(/매뉴얼.*없음/)).toBeInTheDocument();
  });

  it("파일 행은 이름·크기·수정일 표시 + SharePoint URL 링크", () => {
    render(<ManualList heading="A" rows={[file({ id: "F1" })]} />);
    const link = screen.getByText("A01. 원서접수 매뉴얼.docx").closest("a");
    expect(link).toHaveAttribute(
      "href",
      "https://example.sharepoint.com/A01.docx",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByText(/KB|MB/)).toBeInTheDocument();
  });

  it("폴더 행은 size '-' + 종류 표시 없이 ▦ 아이콘", () => {
    const { container } = render(
      <ManualList heading="폴더" rows={[folder({ id: "FOL1" })]} />,
    );
    expect(screen.getByText("외부 배포 매뉴얼")).toBeInTheDocument();
    expect(container.textContent ?? "").toContain("▦");
  });
});
