import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ListRow } from "../../../patterns/ListPattern";
import { ReceivablesTable } from "../../list-variants/receivables/Table";

function makeRow(overrides: Partial<ListRow> = {}): ListRow {
  return {
    id: "r-0",
    name: "서울고등학교",
    body: "2026 수시 전형료",
    status: "active",
    owner: "박현주",
    author: "₩1,200,000",
    meta: "2026-03-01",
    receivablesCells: {
      headers: ["거래처", "청구일자", "청구금액", "학교담당자"],
      textValues: [
        "서울고등학교",
        "2026-03-01",
        "₩1,200,000",
        "manager@seoul.hs.kr",
      ],
      schoolOwner: "manager@seoul.hs.kr",
    },
    ...overrides,
  };
}

describe("ReceivablesTable — 경과일수 / 학교 담당자 이메일 칼럼", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T00:00:00Z")); // 청구일자(2026-03-01 UTC) +10일
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("헤더에 운영자 다음 경과일수·학교 담당자 이메일 칼럼이 있다", () => {
    render(
      <ReceivablesTable
        rows={[makeRow()]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toContain("경과일수");
    expect(headers).toContain("학교 담당자 이메일");
    const ownerIdx = headers.indexOf("운영자");
    expect(headers.indexOf("경과일수")).toBe(ownerIdx + 1);
    expect(headers.indexOf("학교 담당자 이메일")).toBe(ownerIdx + 2);
  });

  it("경과일수 값 표시 — 청구일자 기준 일수", () => {
    render(
      <ReceivablesTable
        rows={[makeRow()]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("10일")).toBeInTheDocument();
  });

  it("학교 담당자 이메일 값 표시", () => {
    render(
      <ReceivablesTable
        rows={[makeRow()]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("manager@seoul.hs.kr")).toBeInTheDocument();
  });

  it("청구일자 파싱 불가/미래 — 경과일수 '-'", () => {
    render(
      <ReceivablesTable
        rows={[makeRow({ meta: "2099-01-01" })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const row = screen.getByRole("row", { name: /서울고등학교/ });
    expect(within(row).getAllByText("-").length).toBeGreaterThan(0);
  });

  it("학교 담당자 이메일 없음 — '-'", () => {
    render(
      <ReceivablesTable
        rows={[
          makeRow({
            receivablesCells: {
              headers: ["거래처"],
              textValues: ["서울고등학교"],
              schoolOwner: "",
            },
          }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const row = screen.getByRole("row", { name: /서울고등학교/ });
    expect(within(row).getAllByText("-").length).toBeGreaterThan(0);
  });

  it("빈 목록 colSpan — 데이터 없음", () => {
    render(<ReceivablesTable rows={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();
  });
});
