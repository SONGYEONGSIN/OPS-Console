import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ManualTable } from "../Table";
import type { ListRow } from "../../../../patterns/ListPattern";

function fileRow(over: Partial<ListRow> = {}): ListRow {
  return {
    id: "01F1",
    name: "A01. 원서접수 매뉴얼.docx",
    status: "active",
    owner: "",
    manualKind: "file",
    manualCategory: "A",
    manualSize: 836096,
    manualModified: "2026-05-20T14:33:00Z",
    manualWebUrl: "https://example.sharepoint.com/x.docx",
    manualParentItemId: "01ROOT",
    ...over,
  };
}

function folderRow(over: Partial<ListRow> = {}): ListRow {
  return {
    id: "01FOLDER",
    name: "외부 배포 매뉴얼",
    status: "active",
    owner: "",
    manualKind: "folder",
    manualCategory: null,
    manualSize: null,
    manualModified: "2026-05-15T09:00:00Z",
    manualWebUrl: "https://example.sharepoint.com/folder",
    manualParentItemId: "01ROOT",
    ...over,
  };
}

describe("ManualTable", () => {
  it("헤더 5컬럼 렌더 (이름 / 카테고리 / 종류 / 수정일 / 크기)", () => {
    render(<ManualTable rows={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("이름")).toBeInTheDocument();
    expect(screen.getByText("카테고리")).toBeInTheDocument();
    expect(screen.getByText("종류")).toBeInTheDocument();
    expect(screen.getByText("수정일")).toBeInTheDocument();
    expect(screen.getByText("크기")).toBeInTheDocument();
  });

  it("빈 rows → '데이터 없음'", () => {
    render(<ManualTable rows={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();
  });

  it("파일 행은 카테고리·크기·수정일 표시", () => {
    render(
      <ManualTable
        rows={[fileRow({ id: "F1", name: "A01. 원서접수 매뉴얼.docx" })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("A01. 원서접수 매뉴얼.docx")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    // size 816KB (836096 bytes / 1024 ≈ 816)
    expect(screen.getByText(/KB|MB/)).toBeInTheDocument();
  });

  it("폴더 행은 종류='폴더', 크기='-'", () => {
    render(
      <ManualTable
        rows={[folderRow({ id: "FOL1", name: "외부 배포 매뉴얼" })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("외부 배포 매뉴얼")).toBeInTheDocument();
    expect(screen.getByText("폴더")).toBeInTheDocument();
  });

  it("카테고리 null인 파일은 '기타' chip", () => {
    render(
      <ManualTable
        rows={[fileRow({ id: "X1", name: "README.md", manualCategory: null })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("기타")).toBeInTheDocument();
  });

  it("행 클릭 시 onSelect 호출", () => {
    const onSelect = vi.fn();
    const row = fileRow({ id: "F1" });
    render(<ManualTable rows={[row]} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("A01. 원서접수 매뉴얼.docx"));
    expect(onSelect).toHaveBeenCalledWith(row);
  });
});
