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
    // 카테고리 'A'는 그룹 헤더 + 칩 둘 다 출현
    expect(screen.getAllByText("A").length).toBeGreaterThan(0);
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
    // '폴더'는 그룹 헤더 + 종류 컬럼 둘 다 출현
    expect(screen.getAllByText("폴더").length).toBeGreaterThan(0);
  });

  it("카테고리 null인 파일은 '기타' chip", () => {
    render(
      <ManualTable
        rows={[fileRow({ id: "X1", name: "README.md", manualCategory: null })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    // '기타'는 그룹 헤더 + 칩 둘 다 출현
    expect(screen.getAllByText("기타").length).toBeGreaterThan(0);
  });

  it("행 클릭 시 onSelect 호출", () => {
    const onSelect = vi.fn();
    const row = fileRow({ id: "F1" });
    render(<ManualTable rows={[row]} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("A01. 원서접수 매뉴얼.docx"));
    expect(onSelect).toHaveBeenCalledWith(row);
  });

  it("카테고리별 그룹 헤더 + 개수 표시", () => {
    const { container } = render(
      <ManualTable
        rows={[
          fileRow({ id: "A1", name: "A01.docx", manualCategory: "A" }),
          fileRow({ id: "A2", name: "A02.docx", manualCategory: "A" }),
          fileRow({ id: "B1", name: "B01.docx", manualCategory: "B" }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const compact = (container.textContent ?? "").replace(/\s+/g, "");
    expect(compact).toContain("A—원서접수(2)");
    expect(compact).toContain("B—보증보험(1)");
  });

  it("폴더 그룹이 카테고리 그룹보다 먼저 렌더", () => {
    const { container } = render(
      <ManualTable
        rows={[
          fileRow({ id: "A1", name: "A01.docx", manualCategory: "A" }),
          folderRow({ id: "F1", name: "외부 배포" }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const compact = (container.textContent ?? "").replace(/\s+/g, "");
    const folderIdx = compact.indexOf("폴더(");
    const aIdx = compact.indexOf("A—");
    expect(folderIdx).toBeGreaterThan(-1);
    expect(aIdx).toBeGreaterThan(-1);
    expect(folderIdx).toBeLessThan(aIdx);
  });

  it("카테고리 null 파일은 '기타' 그룹으로 끝에 배치", () => {
    const { container } = render(
      <ManualTable
        rows={[
          fileRow({ id: "X", name: "README.md", manualCategory: null }),
          fileRow({ id: "I1", name: "I01.docx", manualCategory: "I" }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const compact = (container.textContent ?? "").replace(/\s+/g, "");
    const iIdx = compact.indexOf("I—");
    const etcIdx = compact.indexOf("기타(");
    expect(iIdx).toBeGreaterThan(-1);
    expect(etcIdx).toBeGreaterThan(-1);
    expect(iIdx).toBeLessThan(etcIdx);
  });
});
