import { describe, it, expect } from "vitest";

import { extractCategoryFromName, mapChildToManualRow } from "../queries";

describe("extractCategoryFromName", () => {
  it("'A01. xxx.docx' → 'A'", () => {
    expect(extractCategoryFromName("A01. 원서접수 매뉴얼.docx")).toBe("A");
  });

  it("'B11. xxx.pptx' → 'B'", () => {
    expect(extractCategoryFromName("B11. 보증보험 발급 업무흐름도.pptx")).toBe("B");
  });

  it("'H02. xxx (2304).docx' → 'H'", () => {
    expect(extractCategoryFromName("H02. 경찰청 원서접수 매뉴얼(2304).docx")).toBe("H");
  });

  it("'I05. xxx' → 'I'", () => {
    expect(extractCategoryFromName("I05. 홍대미활 사이트 운영 매뉴얼.docx")).toBe("I");
  });

  it("'00. 연간 운영부 업무 구성표.xlsx' → null (숫자 시작)", () => {
    expect(extractCategoryFromName("00. 연간 운영부 업무 구성표.xlsx")).toBeNull();
  });

  it("'(보안) 업무 포털 접속 정보 관리.xlsx' → null (특수문자 시작)", () => {
    expect(extractCategoryFromName("(보안) 업무 포털 접속 정보 관리.xlsx")).toBeNull();
  });

  it("'README.md' → null (접두사 없음)", () => {
    expect(extractCategoryFromName("README.md")).toBeNull();
  });

  it("폴더 이름 '외부 배포 매뉴얼' → null", () => {
    expect(extractCategoryFromName("외부 배포 매뉴얼")).toBeNull();
  });
});

describe("mapChildToManualRow", () => {
  const basePath = "운영부/05. 매뉴얼";

  it("폴더 child → kind=folder, size=null, mimeType=null", () => {
    const child = {
      id: "01TGOQ_FOLDER",
      name: "외부 배포 매뉴얼",
      webUrl: "https://example.sharepoint.com/folder",
      folder: { childCount: 6 },
      size: 0,
      lastModifiedDateTime: "2026-05-20T10:00:00Z",
      parentReference: { id: "01TGOQVTUKW6DM6CB3T5DIJOFQFXSGUV6F", path: basePath },
    };
    const row = mapChildToManualRow(child);
    expect(row.kind).toBe("folder");
    expect(row.size).toBeNull();
    expect(row.mimeType).toBeNull();
    expect(row.category).toBeNull();
    expect(row.name).toBe("외부 배포 매뉴얼");
    expect(row.parentItemId).toBe("01TGOQVTUKW6DM6CB3T5DIJOFQFXSGUV6F");
  });

  it("파일 child → kind=file, size/mimeType 보존, category 추출", () => {
    const child = {
      id: "01TGOQ_FILE",
      name: "A01. 원서접수 매뉴얼.docx",
      webUrl: "https://example.sharepoint.com/file.docx",
      file: {
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      size: 836096,
      lastModifiedDateTime: "2026-05-20T14:33:00Z",
      parentReference: { id: "01TGOQVTUKW6DM6CB3T5DIJOFQFXSGUV6F", path: basePath },
    };
    const row = mapChildToManualRow(child);
    expect(row.kind).toBe("file");
    expect(row.size).toBe(836096);
    expect(row.mimeType).toContain("officedocument");
    expect(row.category).toBe("A");
    expect(row.lastModifiedDateTime).toBe("2026-05-20T14:33:00Z");
  });

  it("parentReference 없으면 parentItemId=null", () => {
    const child = {
      id: "01X",
      name: "B01. 보증.docx",
      webUrl: "https://example.sharepoint.com/x",
      file: { mimeType: "application/x" },
      size: 100,
      lastModifiedDateTime: "2026-05-20T10:00:00Z",
    };
    const row = mapChildToManualRow(child);
    expect(row.parentItemId).toBeNull();
  });
});
