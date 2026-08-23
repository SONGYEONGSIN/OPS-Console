import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { InvoiceRow } from "@/features/invoice/rows";

const { issueSpy, result } = vi.hoisted(() => ({
  issueSpy: vi.fn(),
  result: { value: { ok: true } as unknown },
}));
vi.mock("@/features/invoice/actions", () => ({
  setInvoiceIssued: (...a: unknown[]) => {
    issueSpy(...a);
    return Promise.resolve(result.value);
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { InvoiceTable } = await import("../InvoiceTable");

const row = (over: Record<string, unknown> = {}): InvoiceRow =>
  ({
    id: "1",
    service_id: 100,
    university_name: "충청대학교",
    service_name: "2027 수시",
    operator_name: "김담당",
    pay_end_at: "2026-08-01T00:00:00Z",
    settledAt: "2026-08-20T00:00:00Z",
    issuedAt: null,
    issueType: null,
    billedAmount: null,
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

/**
 * 계산서발행 화면이 지켜야 할 것 셋.
 *
 * 1. 발행은 **유형 선택 하나**로 한다 — 체크와 유형을 따로 두면 유형 없이
 *    발행된 행이 생긴다.
 * 2. 안 한 것을 **'미발행'으로 드러낸다** — 기본값을 넣으면 발행한 척이 된다.
 * 3. 청구금액이 없을 때 **0 으로 보이지 않는다** — Moa 연동 전까지 전부 비어
 *    있고, 0 원이면 "청구할 게 없다"로 읽혀 발행을 건너뛰게 된다.
 */
describe("InvoiceTable", () => {
  beforeEach(() => {
    issueSpy.mockClear();
    result.value = { ok: true };
  });

  it("빈 목록일 때 어디서 채워지는지 알려준다", () => {
    render(<InvoiceTable rows={[]} />);
    expect(screen.getByText(/전형료 정산에서 완료 표시/)).toBeInTheDocument();
  });

  it("발행유형을 고르면 그것으로 발행한다", async () => {
    render(<InvoiceTable rows={[row()]} />);
    fireEvent.change(screen.getByLabelText(/발행유형/), {
      target: { value: "청구" },
    });
    await waitFor(() => expect(issueSpy).toHaveBeenCalledWith(100, "청구"));
  });

  it("미발행으로 되돌리면 기록을 지운다", async () => {
    render(
      <InvoiceTable
        rows={[row({ issueType: "청구", issuedAt: "2026-08-24T00:00:00Z" })]}
      />,
    );
    fireEvent.change(screen.getByLabelText(/발행유형/), {
      target: { value: "" },
    });
    await waitFor(() => expect(issueSpy).toHaveBeenCalledWith(100, null));
  });

  it("발행 안 한 줄은 '미발행'으로 보인다 — 기본값을 넣으면 발행한 척이 된다", () => {
    render(<InvoiceTable rows={[row()]} />);
    const sel = screen.getByLabelText(/발행유형/) as HTMLSelectElement;
    expect(sel.value).toBe("");
    expect(screen.getByText("미발행")).toBeInTheDocument();
  });

  it("청구금액이 없으면 0 이 아니라 빈 자리로 보여준다", () => {
    render(<InvoiceTable rows={[row()]} />);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("청구금액이 있으면 세 자리마다 끊어 보여준다", () => {
    render(<InvoiceTable rows={[row({ billedAmount: 97500000 })]} />);
    expect(screen.getByText("97,500,000")).toBeInTheDocument();
  });

  it("정산완료일을 보여준다 — 이 목록에 왜 있는지가 그것이다", () => {
    render(<InvoiceTable rows={[row()]} />);
    expect(screen.getByText(/08\. 20\./)).toBeInTheDocument();
  });

  it("거절당하면 그 자리에 이유를 띄운다", async () => {
    result.value = { ok: false, error: "본인이 담당한 서비스만 발행할 수 있습니다" };
    render(<InvoiceTable rows={[row()]} />);
    fireEvent.change(screen.getByLabelText(/발행유형/), {
      target: { value: "청구" },
    });
    await waitFor(() =>
      expect(screen.getByText(/본인이 담당한 서비스만/)).toBeInTheDocument(),
    );
  });
});
