import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { PostalTable } from "../PostalTable";
import type { ReceiptCard, ExtractState } from "@/features/postal/queries";

/**
 * 확정 결과는 확정된 뒤에도 남아야 한다.
 *
 * 확정하면 서버가 `confirmed_at` 을 채우고 같은 응답에서 화면을 다시 그린다. 확정 버튼은
 * 확정 전에만 그려지므로 결과를 버튼이 들고 있으면 그 순간 같이 사라진다 — 2026-10-21
 * 부터 2주 동안 전도금 실패가 '잠깐 떴다 사라진' 이유다. 그래서 영수증 행이 들고 있다.
 */
const { confirmResult } = vi.hoisted(() => ({
  confirmResult: { value: null as unknown },
}));
vi.mock("@/features/postal/extract-actions", () => ({
  confirmReceipt: () => Promise.resolve(confirmResult.value),
  requestExtraction: () => Promise.resolve({ ok: true }),
}));
// 검토표는 이 파일의 관심사가 아니다.
vi.mock("../ReceiptReview", async () => {
  const actual =
    await vi.importActual<typeof import("../ReceiptReview")>(
      "../ReceiptReview",
    );
  return { ...actual, ReceiptReview: () => <div>리뷰</div> };
});

const REASON =
  "현재 잔액을 읽지 못했습니다 — '2026' 시트 97행 잔액(C) 칸이 비어 있습니다";

const pending: ReceiptCard = {
  id: "r1",
  uploadedBy: "op@x.com",
  createdAt: "2026-10-22T07:00:00Z",
  confirmedAt: null,
  imageUrl: null,
};
const confirmed: ReceiptCard = {
  ...pending,
  confirmedAt: "2026-10-22T07:14:00Z",
};

const states: Record<string, ExtractState> = {
  r1: {
    status: "done",
    warnings: [],
    message: null,
    acceptedAt: "2026-10-22",
    hasRegions: false,
    requestedAt: "2026-10-22T07:01:00Z",
    rows: [
      {
        daySeq: 1,
        trackingNo: "00000-0000-0001",
        fee: 4350,
        postalCode: "00000",
        recipientOrg: "테스트대",
        recipientName: "수신자",
        basis: "undergraduate",
        assignee: "담당자",
        candidates: [],
      },
    ],
  },
};

const outcome = (
  ledger: unknown,
  pettyCash: unknown,
): { ok: true; outcome: unknown } => ({
  ok: true,
  outcome: { ledger, pettyCash },
});

/** 확정을 누르고, 서버가 확정된 행으로 다시 그린 상황까지 만든다. */
const confirmAndRefresh = async () => {
  const view = render(
    <PostalTable receipts={[pending]} extractStates={states} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "확정" }));
  await screen.findByRole("button", { name: "확정 결과 닫기" });
  view.rerender(<PostalTable receipts={[confirmed]} extractStates={states} />);
  return view;
};

describe("PostalTable — 확정 결과는 확정된 뒤에도 남는다", () => {
  beforeEach(() => {
    confirmResult.value = outcome(
      { status: "written" },
      { status: "failed", error: REASON },
    );
  });

  it("전도금 실패 경고가 다시 그려진 뒤에도 남는다", async () => {
    await confirmAndRefresh();
    // 확정 버튼은 사라졌다 — 그래도 경고는 남아야 한다.
    expect(screen.queryByRole("button", { name: "확정" })).toBeNull();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain(
      `전도금 대장에 적히지 않았습니다: ${REASON}`,
    );
    expect(alert.textContent).toContain(
      "전도금 탭 [사용내역 추가]로 직접 넣어 주세요.",
    );
  });

  it("경고는 표 너비를 다 쓰는 줄이다 — 버튼 옆 좁은 칸에 끼지 않는다", async () => {
    await confirmAndRefresh();
    const td = screen.getByRole("alert").closest("td");
    expect(td?.getAttribute("colspan")).toBe("8");
  });

  it("[닫기]로 치운다", async () => {
    await confirmAndRefresh();
    fireEvent.click(screen.getByRole("button", { name: "확정 결과 닫기" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "확정 결과 닫기" })).toBeNull();
  });

  it("[닫기]는 버튼 호버 표준이다", async () => {
    await confirmAndRefresh();
    const cls = screen
      .getByRole("button", { name: "확정 결과 닫기" })
      .className.split(/\s+/);
    for (const c of ["hover:bg-ink", "hover:text-cream", "hover:border-ink"]) {
      expect(cls).toContain(c);
    }
  });

  it("등기대장 실패 줄도 남는다", async () => {
    confirmResult.value = outcome(
      { status: "failed", error: "시트 잠김" },
      { status: "written" },
    );
    await confirmAndRefresh();
    expect(screen.getByText(/등기대장 — 시트 잠김/)).toBeInTheDocument();
  });

  it("둘 다 적혔으면 줄을 만들지 않는다 — 확정 배지가 이미 말한다", async () => {
    confirmResult.value = outcome({ status: "written" }, { status: "written" });
    render(<PostalTable receipts={[pending]} extractStates={states} />);
    fireEvent.click(screen.getByRole("button", { name: "확정" }));
    // 결과가 돌아올 때까지 기다린 뒤 본다
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(screen.queryByRole("button", { name: "확정 결과 닫기" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
