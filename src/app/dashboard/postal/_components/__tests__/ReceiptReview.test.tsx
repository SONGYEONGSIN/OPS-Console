import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReceiptReview } from "../ReceiptReview";
import type { ExtractState } from "@/features/postal/queries";

const { confirmSpy, extractSpy } = vi.hoisted(() => ({
  confirmSpy: vi.fn(),
  extractSpy: vi.fn(),
}));
vi.mock("@/features/postal/extract-actions", () => ({
  confirmReceipt: (...a: unknown[]) => {
    confirmSpy(...a);
    return Promise.resolve({ ok: true });
  },
  requestExtraction: (...a: unknown[]) => {
    extractSpy(...a);
    return Promise.resolve({ ok: true });
  },
}));

const RID = "ab3599d5-e6a8-4631-9342-8338ca4e4ad5";

const done: ExtractState = {
  status: "done",
  warnings: [],
  message: null,
  acceptedAt: "2026-08-18",
  rows: [
    {
      daySeq: 1, trackingNo: "11263-1102-7080", fee: 4590, postalCode: "55338",
      recipientOrg: "우석대", recipientName: "강정화",
      basis: "undergraduate", assignee: "김지현", candidates: [{ university: "우석대학교", operator: "김지현" }],
    },
    {
      daySeq: 2, trackingNo: "11263-1102-7081", fee: 4230, postalCode: "24210",
      recipientOrg: "건국대", recipientName: "김한솔",
      basis: "undergraduate", assignee: null,
      candidates: [
        { university: "건국대학교(서울)", operator: "이해영" },
        { university: "건국대학교(글로컬)", operator: "전혜인" },
      ],
    },
  ],
};

describe("ReceiptReview", () => {
  beforeEach(() => {
    confirmSpy.mockClear();
    extractSpy.mockClear();
  });

  it("판독이 안 걸린 상태면 다시 걸 수 있다 — 업로드 시 자동으로 걸리지만 실패할 수 있다", () => {
    render(<ReceiptReview rows={[]} onRowsChange={() => {}} receiptId={RID} state={{ status: "none", warnings: [], message: null, acceptedAt: null, rows: [] }} />);
    expect(screen.getByRole("button", { name: "다시 추출" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("다시 추출을 누르면 판독을 요청한다", async () => {
    render(<ReceiptReview rows={[]} onRowsChange={() => {}} receiptId={RID} state={{ status: "none", warnings: [], message: null, acceptedAt: null, rows: [] }} />);
    fireEvent.click(screen.getByRole("button", { name: "다시 추출" }));
    await waitFor(() => expect(extractSpy).toHaveBeenCalledWith(RID));
  });

  it("도는 중이면 그렇다고 알린다 — 30초쯤 걸린다", () => {
    render(<ReceiptReview rows={[]} onRowsChange={() => {}} receiptId={RID} state={{ status: "running", warnings: [], message: null, acceptedAt: null, rows: [] }} />);
    expect(screen.getByText(/읽는 중/)).toBeInTheDocument();
  });

  it("판독이 끝나면 표로 보여준다", () => {
    render(<ReceiptReview onRowsChange={() => {}} receiptId={RID} state={done} rows={done.rows} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByDisplayValue("11263-1102-7080")).toBeInTheDocument();
  });

  it("담당자가 유일하면 채워져 있다", () => {
    render(<ReceiptReview onRowsChange={() => {}} receiptId={RID} state={done} rows={done.rows} />);
    expect(screen.getByDisplayValue("김지현")).toBeInTheDocument();
  });

  it("후보가 여럿이면 고르게 한다 — 자동으로 채우지 않는다", () => {
    render(<ReceiptReview onRowsChange={() => {}} receiptId={RID} state={done} rows={done.rows} />);
    const selects = screen.getAllByRole("combobox");
    expect(selects.length).toBeGreaterThan(0);
    expect(screen.getByRole("option", { name: /이해영/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /전혜인/ })).toBeInTheDocument();
  });

  it("고친 값을 밖으로 올린다 — 확정 버튼이 그 값을 쓴다", () => {
    // 확정 버튼은 영수증 행에 있다(삭제와 나란히). 그래서 검토표는 고친 값을
    // 위로 올리기만 하고, 실제 확정은 PostalTable 테스트가 본다(2026-08-21).
    const seen: { recipientName: string | null }[][] = [];
    render(
      <ReceiptReview
        onRowsChange={(r) => seen.push(r)}
        receiptId={RID}
        state={done}
        rows={done.rows}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("강정화"), {
      target: { value: "강정화A" },
    });
    expect(seen.at(-1)?.[0].recipientName).toBe("강정화A");
  });

  it("검산 경고를 띄운다 — 잘못 읽은 것을 사람이 보기 전에 알린다", () => {
    render(<ReceiptReview onRowsChange={() => {}} receiptId={RID} state={{ ...done, warnings: ["합계가 맞지 않습니다"] }} rows={done.rows} />);
    expect(screen.getByText(/합계가 맞지 않습니다/)).toBeInTheDocument();
  });

  it("실패하면 사유를 보여주고 다시 시도할 수 있다", () => {
    render(<ReceiptReview onRowsChange={() => {}} receiptId={RID} state={{ status: "failed", warnings: [], message: "영수증이 아닙니다", acceptedAt: null, rows: [] }} rows={[]} />);
    expect(screen.getByText(/영수증이 아닙니다/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 추출" })).toBeInTheDocument();
  });
});
