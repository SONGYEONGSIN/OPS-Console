import { describe, expect, it } from "vitest";
import {
  ManualSourceError,
  parseActiveTasks,
  parseLedgerSheet,
  splitOwners,
} from "../parse";

const HEADER = [
  "코드",
  "구분",
  "업무",
  "종류",
  "문서명",
  "담당자",
  "보관 위치",
  "최종 수정",
  "링크 상태",
  "개정 이력 점검",
];

const ledgerValues: unknown[][] = [
  ["2. 매뉴얼 대장", "", "", "", "", "", "", "", "", ""],
  ["문서 1건 = 1행", "", "", "", "", "", "", "", "", ""],
  ["", "", "", "", "", "", "", "", "", ""],
  HEADER,
  [
    "A01",
    "A",
    "원서접수",
    "매뉴얼",
    "A01. 원서접수 매뉴얼.docx",
    "담당자A",
    "/운영부/05. 매뉴얼",
    "2026.03.02",
    "정상",
    "-",
  ],
  ["", "", "", "", "", "", "", "", "", ""],
  [
    "D01",
    "D",
    " 정산 ",
    "체크리스트",
    "D01. 정산 체크리스트.xlsx",
    "담당자A, 담당자B",
    "/운영부/05. 매뉴얼",
    "",
    "정상",
    "-",
  ],
];

describe("parseLedgerSheet", () => {
  it("머리행을 이름으로 찾아 데이터 행을 읽고 빈 행은 버린다", () => {
    expect(parseLedgerSheet(ledgerValues)).toEqual([
      {
        code: "A01",
        task: "원서접수",
        docName: "A01. 원서접수 매뉴얼.docx",
        ownerText: "담당자A",
        owners: ["담당자A"],
        lastModified: "2026.03.02",
      },
      {
        code: "D01",
        task: "정산",
        docName: "D01. 정산 체크리스트.xlsx",
        ownerText: "담당자A, 담당자B",
        owners: ["담당자A", "담당자B"],
        lastModified: null,
      },
    ]);
  });

  it("열 순서가 바뀌고 선택 열이 없어도 읽는다", () => {
    const values = [
      ["담당자", "문서명", "업무"],
      ["담당자A", "A01. 원서접수 매뉴얼.docx", "원서접수"],
    ];
    expect(parseLedgerSheet(values)).toEqual([
      {
        code: null,
        task: "원서접수",
        docName: "A01. 원서접수 매뉴얼.docx",
        ownerText: "담당자A",
        owners: ["담당자A"],
        lastModified: null,
      },
    ]);
  });

  it("머리 셀의 공백·줄바꿈은 무시한다", () => {
    const values = [
      ["업무", "문서명", " 담당자 ", "최종\n수정"],
      ["원서접수", "a.docx", "담당자A", "2026.01.05"],
    ];
    const [row] = parseLedgerSheet(values);
    expect(row.ownerText).toBe("담당자A");
    expect(row.lastModified).toBe("2026.01.05");
  });

  it("필수 열을 못 찾으면 빈 결과가 아니라 실패다", () => {
    const values = [
      ["코드", "업무", "문서명"],
      ["A01", "원서접수", "a.docx"],
    ];
    expect(() => parseLedgerSheet(values)).toThrow(ManualSourceError);
    expect(() => parseLedgerSheet(values)).toThrow(/담당자/);
  });

  it("숫자 셀은 문자열로 그대로 둔다", () => {
    const values = [
      ["업무", "문서명", "담당자", "최종 수정"],
      ["원서접수", "a.docx", "담당자A", 45678],
    ];
    expect(parseLedgerSheet(values)[0].lastModified).toBe("2025.01.21");
  });

  it("엑셀 일련번호는 1899-12-30 기준 날짜로 바꾼다", () => {
    const serial = 45678;
    const expected = new Date(Date.UTC(1899, 11, 30) + serial * 86_400_000)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, ".");
    expect(expected).toBe("2025.01.21");
    const values = [
      ["업무", "문서명", "담당자", "최종 수정"],
      ["원서접수", "a.docx", "담당자A", serial],
    ];
    expect(parseLedgerSheet(values)[0].lastModified).toBe(expected);
  });

  it("일련번호 범위 밖 숫자는 문자열 그대로", () => {
    const values = [
      ["업무", "문서명", "담당자", "최종 수정"],
      ["원서접수", "a.docx", "담당자A", 12345],
    ];
    expect(parseLedgerSheet(values)[0].lastModified).toBe("12345");
  });
});

describe("splitOwners", () => {
  it("쉼표·슬래시·가운뎃점·줄바꿈으로 나눈다", () => {
    expect(splitOwners(" 담당자A , 담당자B ")).toEqual(["담당자A", "담당자B"]);
    expect(splitOwners("담당자A/담당자B")).toEqual(["담당자A", "담당자B"]);
    expect(splitOwners("담당자A·담당자B")).toEqual(["담당자A", "담당자B"]);
    expect(splitOwners("담당자A\n담당자B")).toEqual(["담당자A", "담당자B"]);
  });

  it("빈 칸은 빈 목록, 중복은 하나로", () => {
    expect(splitOwners("")).toEqual([]);
    expect(splitOwners("담당자A, 담당자A")).toEqual(["담당자A"]);
  });
});

const scheduleValues: unknown[][] = [
  ["1. 연간 일정", "", ""],
  ["", "", ""],
  ["", "", ""],
  ["구분", "업무", "담당자", "3월", "4월"],
  ["▪ 진행 중", "", "", "", ""],
  ["A", "원서접수", "담당자A", "●", ""],
  ["", "", "담당자B", "", "●"],
  ["D", "정산", "담당자A", "", "●"],
  ["▪ 진행하지 않는 사업", "", "", "", ""],
  ["X", "구사업", "담당자C", "", ""],
  ["▪ 이관/중단", "", "", "", ""],
  ["Y", "이관업무", "담당자D", "", ""],
];

describe("parseActiveTasks", () => {
  it("'진행 중' 구역의 업무만 모은다", () => {
    expect(parseActiveTasks(scheduleValues)).toEqual(
      new Set(["원서접수", "정산"]),
    );
  });

  it("머리행 문구가 조금 달라도 진행 중 구역을 알아본다", () => {
    const values = scheduleValues.map((r) =>
      r[0] === "▪ 진행 중" ? ["▪ 진행중 (10)", "", "", "", ""] : r,
    );
    expect(parseActiveTasks(values)).toEqual(new Set(["원서접수", "정산"]));
  });

  it("데이터 행의 비고 칸에 ▪ 가 있어도 구역이 바뀌지 않는다", () => {
    const values: unknown[][] = [
      ["구분", "업무", "담당자", "3월", "비고"],
      ["▪ 진행 중", "", "", "", ""],
      ["A", "원서접수", "담당자A", "●", "▪ 진행하지 않는 사업에서 옮김"],
      ["메모", "", "", "", "▪ 이관 예정"],
      ["D", "정산", "담당자A", "●", ""],
    ];
    expect(parseActiveTasks(values)).toEqual(new Set(["원서접수", "정산"]));
  });

  it("진행 중 구역 머리행이 없으면 실패다", () => {
    const values = scheduleValues.filter((r) => r[0] !== "▪ 진행 중");
    expect(() => parseActiveTasks(values)).toThrow(ManualSourceError);
  });

  it("머리행(업무·담당자)이 없으면 실패다", () => {
    const values = scheduleValues.filter((r) => r[0] !== "구분");
    expect(() => parseActiveTasks(values)).toThrow(ManualSourceError);
  });
});
