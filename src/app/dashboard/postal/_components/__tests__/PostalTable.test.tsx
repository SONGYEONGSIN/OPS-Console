import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PostalTable } from "../PostalTable";
import type { ReceiptCard, ExtractState } from "@/features/postal/queries";

vi.mock("../ReceiptReview", () => ({
  ReceiptReview: () => <div>리뷰</div>,
}));

const receipts: ReceiptCard[] = [
  {
    id: "r1",
    uploadedBy: "song@x.com",
    createdAt: "2026-08-18T01:00:00Z",
    confirmedAt: null,
    imageUrl: "https://example.test/a.jpg",
  },
  {
    id: "r2",
    uploadedBy: "kim@x.com",
    createdAt: "2026-08-19T02:00:00Z",
    confirmedAt: "2026-08-19T03:00:00Z",
    imageUrl: "https://example.test/b.jpg",
  },
];

const states: Record<string, ExtractState> = {
  r1: { status: "none", warnings: [], message: null, acceptedAt: null, rows: [] },
  r2: {
    status: "done", warnings: [], message: null, acceptedAt: "2026-08-19",
    rows: [
      {
        daySeq: 1, trackingNo: "11263-1102-7080", fee: 4590, postalCode: "55338",
        recipientOrg: "우석대", recipientName: "강정화",
        basis: "undergraduate", assignee: "김지현", candidates: [],
      },
    ],
  },
};

describe("PostalTable", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("표로 보여준다 — 카드 격자로는 여러 건을 훑기 어렵다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    ["올린 날", "올린 사람", "판독", "등기", "금액", "상태"].forEach((h) =>
      expect(screen.getByRole("columnheader", { name: h })).toBeInTheDocument(),
    );
  });

  it("판독된 건은 등기 수와 금액 합을 보여준다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    expect(screen.getByText("1건")).toBeInTheDocument();
    expect(screen.getByText("4,590원")).toBeInTheDocument();
  });

  it("확정된 건은 그렇다고 표시한다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    expect(screen.getByText("확정")).toBeInTheDocument();
  });

  it("행을 누르면 영수증 원본이 팝업으로 열린다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    fireEvent.click(screen.getByText("song"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByAltText(/영수증 원본/)).toBeInTheDocument();
  });

  it("팝업을 닫을 수 있다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    fireEvent.click(screen.getByText("song"));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("검색으로 거른다 — 올린 사람·날짜·등기번호로 찾는다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    fireEvent.change(screen.getByLabelText("우편물 검색"), {
      target: { value: "kim" },
    });
    expect(screen.getByText("kim")).toBeInTheDocument();
    expect(screen.queryByText("song")).toBeNull();
  });

  it("등기번호로도 찾는다 — 그게 사람이 들고 오는 번호다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    fireEvent.change(screen.getByLabelText("우편물 검색"), {
      target: { value: "7080" },
    });
    expect(screen.getByText("kim")).toBeInTheDocument();
    expect(screen.queryByText("song")).toBeNull();
  });

  it("검색 결과가 없으면 그렇다고 말한다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    fireEvent.change(screen.getByLabelText("우편물 검색"), {
      target: { value: "없는것" },
    });
    expect(screen.getByText(/찾는 영수증이 없습니다/)).toBeInTheDocument();
  });

  it("영수증이 없으면 빈 상태를 보여준다", () => {
    render(<PostalTable receipts={[]} extractStates={{}} />);
    expect(screen.getByText(/올린 영수증이 없습니다/)).toBeInTheDocument();
  });
});
