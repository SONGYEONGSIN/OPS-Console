import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReceiptPrintBar, type PrintPick } from "../ReceiptPrintBar";
import { RECEIPT_PDF_BATCH } from "@/features/postal/receipt-print/layout";

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
/** n 번째 영수증 — 접수 10:00 부터 1분씩 */
const pick = (n: number, hasRegions = true): PrintPick => {
  const t = 600 + n;
  return {
    id: `p${pad(n, 3)}`,
    acceptedAt: `2026-09-23 ${pad(Math.floor(t / 60))}:${pad(t % 60)}`,
    createdAt: "2026-09-23T00:00:00Z",
    hasRegions,
  };
};
const idsOf = (link: HTMLElement) =>
  (
    new URL(link.getAttribute("href") ?? "", "http://x").searchParams.get(
      "ids",
    ) ?? ""
  ).split(",");

describe("ReceiptPrintBar", () => {
  it("고른 것이 없으면 버튼이 꺼져 있다", () => {
    render(<ReceiptPrintBar picks={[]} />);
    expect(
      screen.getByRole("button", { name: "영수증 출력 (0)" }),
    ).toBeDisabled();
  });

  it("고르면 새 탭 PDF 링크 하나 — 접수일시 순", () => {
    render(<ReceiptPrintBar picks={[pick(2), pick(1)]} />);
    const link = screen.getByRole("link", { name: "영수증 출력 (2)" });
    expect(idsOf(link)).toEqual(["p001", "p002"]);
    expect(link).toHaveAttribute("target", "_blank");
    // 헤더 액션 표준(HeaderActionButton) 모양 그대로
    expect(link).toHaveClass("bg-vermilion");
  });

  it(`${RECEIPT_PDF_BATCH}장이 넘으면 ${RECEIPT_PDF_BATCH}장씩 나눈 버튼을 놓는다`, () => {
    const B = RECEIPT_PDF_BATCH;
    render(
      <ReceiptPrintBar
        picks={Array.from({ length: B + 1 }, (_, i) => pick(i + 1))}
      />,
    );
    expect(
      screen.getByText(`${B + 1}장 — ${B}장씩 나눠 받습니다`),
    ).toBeInTheDocument();
    expect(
      idsOf(screen.getByRole("link", { name: `1~${B}장 PDF` })),
    ).toHaveLength(B);
    expect(idsOf(screen.getByRole("link", { name: `${B + 1}장 PDF` }))).toEqual(
      [`p${pad(B + 1, 3)}`],
    );
    expect(screen.queryByRole("link", { name: /영수증 출력/ })).toBeNull();
  });

  it("형광펜 자리를 다 못 찾은 장수를 적는다 — PDF 에는 안 찍으니 여기서 알린다", () => {
    render(
      <ReceiptPrintBar picks={[pick(1, false), pick(2), pick(3, false)]} />,
    );
    const note = screen.getByText("3장 중 2장은 형광펜이 빠진 곳이 있습니다");
    expect(note).toHaveClass("text-muted");
  });

  it("다 찾았으면 안내가 없다", () => {
    render(<ReceiptPrintBar picks={[pick(1), pick(2)]} />);
    expect(screen.queryByText(/형광펜이 빠진/)).toBeNull();
  });
});
