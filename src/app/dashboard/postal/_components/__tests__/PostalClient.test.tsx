import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const uploaded: File[] = [];
const result = { ok: true as boolean, error: "" };
vi.mock("@/features/postal/actions", () => ({
  uploadReceipt: (f: File) => {
    uploaded.push(f);
    return Promise.resolve(
      result.ok ? { ok: true, id: "r1" } : { ok: false, error: result.error },
    );
  },
}));
// 대장 표가 연도 칩·페이지에 쓰려고 pathname/searchParams 도 읽는다.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => "/dashboard/postal",
  useSearchParams: () => new URLSearchParams(),
}));

const { PostalClient } = await import("../PostalClient");

/** 대장은 이 파일의 관심사가 아니다 — 빈 값으로 고정한다. */
const EMPTY = {
  sheetName: "",
  years: [],
  year: 2026,
  rows: [],
  receiptUrls: {},
  error: null,
};

const card = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  uploadedBy: "박수정",
  createdAt: "2026-08-19T02:00:00+00:00",
  confirmedAt: null,
  imageUrl: "https://signed/a.jpg",
  ...over,
});

const jpg = (name = "receipt.jpg") =>
  new File(["x"], name, { type: "image/jpeg" });

describe("PostalClient", () => {
  beforeEach(() => {
    uploaded.length = 0;
    result.ok = true;
    result.error = "";
  });

  // 카드 격자에서 표로 바꿨다(여러 건을 훑기 어려웠다). 원본은 행을 눌러 팝업으로 본다.
  it("올린 영수증이 목록에 보인다 — 올린 사람과 함께", () => {
    render(<PostalClient ledger={EMPTY} receipts={[card()]} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("박수정")).toBeInTheDocument();
  });

  it("행을 누르면 원본이 팝업으로 열린다 — 목록에 사진을 늘어놓으면 숫자가 안 보인다", () => {
    render(<PostalClient ledger={EMPTY} receipts={[card()]} />);
    fireEvent.click(screen.getByText("박수정"));
    expect(screen.getByRole("img", { name: /영수증 원본/ })).toHaveAttribute(
      "src",
      "https://signed/a.jpg",
    );
  });

  it("아직 없으면 무엇을 하면 되는지 알려준다", () => {
    render(<PostalClient ledger={EMPTY} receipts={[]} />);
    expect(screen.getByTestId("postal-dropzone").textContent).toMatch(/끌어다 놓/);
    // 대장이 비면 대장이 그렇게 말한다. 검토 대기가 없을 땐 그 표를 아예 안 그린다 —
    // 일감이 없는데 빈 표를 두면 화면만 길어진다.
    expect(screen.getByText(/대장에 기록된 발송이 없습니다/)).toBeInTheDocument();
  });

  it("파일을 떨구면 업로드한다", async () => {
    render(<PostalClient ledger={EMPTY} receipts={[]} />);
    const zone = screen.getByTestId("postal-dropzone");
    fireEvent.drop(zone, { dataTransfer: { files: [jpg()] } });
    await waitFor(() => expect(uploaded).toHaveLength(1));
  });

  it("여러 장을 한 번에 떨궈도 다 올린다", async () => {
    render(<PostalClient ledger={EMPTY} receipts={[]} />);
    fireEvent.drop(screen.getByTestId("postal-dropzone"), {
      dataTransfer: { files: [jpg("a.jpg"), jpg("b.jpg")] },
    });
    await waitFor(() => expect(uploaded).toHaveLength(2));
  });

  it("실패하면 이유를 그대로 보여준다 — 요약하면 왜 안 됐는지 모른다", async () => {
    result.ok = false;
    result.error = "사진 파일만 올릴 수 있습니다: x.pdf";
    render(<PostalClient ledger={EMPTY} receipts={[]} />);
    fireEvent.drop(screen.getByTestId("postal-dropzone"), {
      dataTransfer: { files: [jpg()] },
    });
    await waitFor(() =>
      expect(screen.getByText(/사진 파일만 올릴 수 있습니다/)).toBeInTheDocument(),
    );
  });

  it("서명이 만료돼 이미지가 없으면 빈칸 대신 그 사실을 쓴다", () => {
    render(<PostalClient ledger={EMPTY} receipts={[card({ imageUrl: null })]} />);
    fireEvent.click(screen.getByText("박수정"));
    expect(screen.getByText(/열 수 없습니다/)).toBeInTheDocument();
  });
});
