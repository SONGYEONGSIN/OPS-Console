import { describe, expect, it } from "vitest";
import { resolveLedger } from "../resolve";
import type { LedgerRow, ManualFolderFile, OperatorEntry } from "../types";

const row = (over: Partial<LedgerRow> = {}): LedgerRow => ({
  code: "A01",
  task: "원서접수",
  docName: "A01. 매뉴얼.docx",
  ownerText: "담당자A",
  owners: ["담당자A"],
  lastModified: null,
  ...over,
});

const file = (name: string, id = "f1"): ManualFolderFile => ({
  id,
  name,
  webUrl: `https://example.test/${id}`,
  lastModifiedDateTime: null,
  cTag: null,
});

const op = (name: string, email: string, status = "active"): OperatorEntry => ({
  name,
  email,
  status,
});

const OPS = [op("담당자A", "a@example.test")];

describe("resolveLedger", () => {
  it("문서명과 같은 이름의 파일에 연결한다", () => {
    const [m] = resolveLedger(
      {
        ledger: [row()],
        activeTasks: new Set(),
        files: [file("A01. 매뉴얼.docx")],
      },
      OPS,
    );
    expect(m.file?.id).toBe("f1");
  });

  it("같은 코드의 다른 버전 파일은 연결하지 않는다", () => {
    const [m] = resolveLedger(
      {
        ledger: [row()],
        activeTasks: new Set(),
        files: [file("A01. 매뉴얼_v2.docx")],
      },
      OPS,
    );
    expect(m.file).toBeNull();
  });

  it("NFD 로 들어온 파일명도 같은 이름으로 본다", () => {
    const name = "A01. 매뉴얼.docx";
    const [m] = resolveLedger(
      {
        ledger: [row({ docName: name })],
        activeTasks: new Set(),
        files: [file(name.normalize("NFD"))],
      },
      OPS,
    );
    expect(m.file?.id).toBe("f1");
  });

  it("명부에 있는 담당자만 받는 사람이 되고 나머지는 미확인이다", () => {
    const [m] = resolveLedger(
      {
        ledger: [
          row({
            owners: ["담당자A", "담당자B"],
            ownerText: "담당자A, 담당자B",
          }),
        ],
        activeTasks: new Set(),
        files: [],
      },
      OPS,
    );
    expect(m.recipients).toEqual([
      { name: "담당자A", email: "a@example.test" },
    ]);
    expect(m.unresolvedOwners).toEqual(["담당자B"]);
  });

  it("삭제된 운영자는 빼고, 동명이인이 남으면 미확인으로 둔다", () => {
    const source = {
      ledger: [row()],
      activeTasks: new Set<string>(),
      files: [],
    };
    const [kept] = resolveLedger(source, [
      op("담당자A", "old@example.test", "deleted"),
      op("담당자A", "a@example.test"),
    ]);
    expect(kept.recipients).toEqual([
      { name: "담당자A", email: "a@example.test" },
    ]);

    const [ambiguous] = resolveLedger(source, [
      op("담당자A", "a1@example.test"),
      op("담당자A", "a2@example.test"),
    ]);
    expect(ambiguous.recipients).toEqual([]);
    expect(ambiguous.unresolvedOwners).toEqual(["담당자A"]);
  });

  it("명부 이름의 앞뒤 공백은 무시한다", () => {
    const [m] = resolveLedger(
      { ledger: [row()], activeTasks: new Set(), files: [] },
      [op(" 담당자A ", "a@example.test")],
    );
    expect(m.recipients).toHaveLength(1);
  });

  it("업무가 진행 중 구역에 있으면 active", () => {
    const [a, b] = resolveLedger(
      {
        ledger: [row(), row({ task: "정산" })],
        activeTasks: new Set(["원서접수"]),
        files: [],
      },
      OPS,
    );
    expect(a.active).toBe(true);
    expect(b.active).toBe(false);
  });
});
