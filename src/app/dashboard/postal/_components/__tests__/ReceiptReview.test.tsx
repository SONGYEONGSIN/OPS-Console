import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReceiptReview, ConfirmButton, OutcomeNote } from "../ReceiptReview";
import type { ExtractState } from "@/features/postal/queries";
import type { ConfirmOutcome } from "@/features/postal/extract-actions";

const { confirmSpy, extractSpy, confirmResult } = vi.hoisted(() => ({
  confirmSpy: vi.fn(),
  extractSpy: vi.fn(),
  // 테스트마다 대장 반영 결과를 갈아끼운다.
  confirmResult: {
    value: {
      ok: true,
      outcome: {
        ledger: { status: "written" },
        pettyCash: { status: "written" },
      },
    } as unknown,
  },
}));
vi.mock("@/features/postal/extract-actions", () => ({
  confirmReceipt: (...a: unknown[]) => {
    confirmSpy(...a);
    return Promise.resolve(confirmResult.value);
  },
  requestExtraction: (...a: unknown[]) => {
    extractSpy(...a);
    return Promise.resolve({ ok: true });
  },
}));

const RID = "ab3599d5-e6a8-4631-9342-8338ca4e4ad5";

/**
 * 확정 결과는 버튼이 아니라 영수증 행(PostalTable RowPair)이 들고 있다 — 확정되면
 * 버튼이 사라지기 때문이다. 여기서는 그 자리를 흉내 낸다.
 */
function ConfirmWithNote({ rows }: { rows: ExtractState["rows"] }) {
  const [outcome, setOutcome] = useState<ConfirmOutcome | null>(null);
  return (
    <>
      <ConfirmButton
        receiptId={RID}
        acceptedAt="2026-08-21 15:44"
        rows={rows}
        onOutcome={setOutcome}
      />
      {outcome && <OutcomeNote outcome={outcome} />}
    </>
  );
}

const done: ExtractState = {
  status: "done",
  warnings: [],
  message: null,
  acceptedAt: "2026-08-18",
  hasRegions: false,
  requestedAt: null,
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
    render(<ReceiptReview rows={[]} onRowsChange={() => {}} receiptId={RID} state={{ status: "none", warnings: [], message: null, acceptedAt: null, rows: [], hasRegions: false, requestedAt: null }} />);
    expect(screen.getByRole("button", { name: "다시 추출" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("다시 추출을 누르면 판독을 요청한다", async () => {
    render(<ReceiptReview rows={[]} onRowsChange={() => {}} receiptId={RID} state={{ status: "none", warnings: [], message: null, acceptedAt: null, rows: [], hasRegions: false, requestedAt: null }} />);
    fireEvent.click(screen.getByRole("button", { name: "다시 추출" }));
    await waitFor(() => expect(extractSpy).toHaveBeenCalledWith(RID));
  });

  it("도는 중이면 그렇다고 알린다 — 30초쯤 걸린다", () => {
    render(<ReceiptReview rows={[]} onRowsChange={() => {}} receiptId={RID} state={{ status: "running", warnings: [], message: null, acceptedAt: null, rows: [], hasRegions: false, requestedAt: null }} />);
    expect(screen.getByText(/읽는 중/)).toBeInTheDocument();
  });

  it("판독이 끝나면 표로 보여준다", () => {
    render(<ReceiptReview onRowsChange={() => {}} receiptId={RID} state={done} rows={done.rows} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByDisplayValue("11263-1102-7080")).toBeInTheDocument();
  });

  it("판독은 됐는데 형광펜 자리가 없으면 안내하고 다시 추출할 수 있다", async () => {
    render(<ReceiptReview onRowsChange={() => {}} receiptId={RID} state={{ ...done, hasRegions: false }} rows={done.rows} />);
    expect(
      screen.getByText("형광펜 자리를 다 찾지 못했습니다 — 출력하면 못 찾은 자리는 형광펜 없이 실립니다."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 추출" }));
    await waitFor(() => expect(extractSpy).toHaveBeenCalledWith(RID));
  });

  it("형광펜 자리가 있으면 안내도 버튼도 없다", () => {
    render(<ReceiptReview onRowsChange={() => {}} receiptId={RID} state={{ ...done, hasRegions: true }} rows={done.rows} />);
    expect(screen.queryByText(/형광펜 자리를 다 찾지 못했습니다/)).toBeNull();
    expect(screen.queryByRole("button", { name: "다시 추출" })).toBeNull();
  });

  it("형광펜 안내가 있어도 검토 표는 그대로 보인다", () => {
    render(<ReceiptReview onRowsChange={() => {}} receiptId={RID} state={{ ...done, hasRegions: false }} rows={done.rows} />);
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
    render(<ReceiptReview onRowsChange={() => {}} receiptId={RID} state={{ status: "failed", warnings: [], message: "영수증이 아닙니다", acceptedAt: null, rows: [], hasRegions: false, requestedAt: null }} rows={[]} />);
    expect(screen.getByText(/영수증이 아닙니다/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 추출" })).toBeInTheDocument();
  });
});

/**
 * 대장 반영 결과를 화면에 띄운다.
 *
 * 확정은 두 엑셀에 옮겨 적는데 **실패해도 확정 자체는 성공**으로 끝난다(다시 누르면
 * 중복 기록이 되므로). 그래서 화면이 말해주지 않으면 사람은 엑셀을 열어봐야 안다.
 */
describe("ConfirmButton — 대장 반영 결과", () => {
  const OK = {
    ok: true,
    outcome: {
      ledger: { status: "written" },
      pettyCash: { status: "written" },
    },
  };

  beforeEach(() => {
    confirmResult.value = OK;
  });

  const press = async () => {
    render(<ConfirmWithNote rows={done.rows} />);
    fireEvent.click(screen.getByRole("button", { name: "확정" }));
  };

  it("둘 다 적히면 적혔다고 알린다", async () => {
    await press();
    await waitFor(() =>
      expect(screen.getByText(/등기대장·전도금대장에 적었습니다/)).toBeInTheDocument(),
    );
  });

  it("실패하면 어느 대장이 왜 안 됐는지 말한다", async () => {
    confirmResult.value = {
      ok: true,
      outcome: {
        ledger: { status: "failed", error: "시트 잠김" },
        pettyCash: { status: "written" },
      },
    };
    await press();
    await waitFor(() =>
      expect(screen.getByText(/등기대장.*시트 잠김/)).toBeInTheDocument(),
    );
  });

  it("건너뛴 이유도 말한다 — 왜 안 갔는지 모르면 기다리게 된다", async () => {
    confirmResult.value = {
      ok: true,
      outcome: {
        ledger: { status: "skipped", reason: "접수일시를 읽지 못했습니다" },
        pettyCash: { status: "skipped", reason: "접수일시를 읽지 못했습니다" },
      },
    };
    await press();
    // 대장마다 한 줄씩 — 어느 쪽이 안 갔는지 알아야 한다.
    await waitFor(() =>
      expect(
        screen.getByText(/등기대장 — 접수일시를 읽지 못했습니다/),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(/전도금대장 — 접수일시를 읽지 못했습니다/),
    ).toBeInTheDocument();
  });

  it("실패는 그냥 지나칠 수 없게 눈에 띄어야 한다", async () => {
    confirmResult.value = {
      ok: true,
      outcome: {
        ledger: { status: "failed", error: "시트 잠김" },
        pettyCash: { status: "written" },
      },
    };
    await press();
    await waitFor(() => {
      const el = screen.getByText(/시트 잠김/);
      expect(el.className).toMatch(/vermilion/);
    });
  });
});

/**
 * 전도금 대장 실패는 버튼 옆 작은 글씨로 두지 않는다.
 *
 * 2026-10-21 이후 2주 동안 확정마다 전도금 쓰기가 거절됐는데, 신호는 버튼 옆에 잠깐 뜬
 * 작은 빨간 글씨뿐이라 아무도 몰랐다. 확정은 성공으로 끝나니 사람이 직접 넣어야 한다.
 */
describe("ConfirmButton — 전도금 대장 실패 안내", () => {
  const REASON = "현재 잔액을 읽지 못했습니다 — '2026' 시트 97행 잔액(C) 칸이 비어 있습니다";

  const press = async () => {
    render(<ConfirmWithNote rows={done.rows} />);
    fireEvent.click(screen.getByRole("button", { name: "확정" }));
  };

  beforeEach(() => {
    confirmResult.value = {
      ok: true,
      outcome: {
        ledger: { status: "written" },
        pettyCash: { status: "failed", error: REASON },
      },
    };
  });

  it("사유와 할 일을 함께 말한다", async () => {
    await press();
    const note = await screen.findByRole("alert");
    expect(note.textContent).toContain(`전도금 대장에 적히지 않았습니다: ${REASON}`);
    expect(note.textContent).toContain("전도금 탭 [사용내역 추가]로 직접 넣어 주세요.");
  });

  it("작은 인라인 글씨가 아니라 한 줄을 차지하는 경고 블록이다", async () => {
    await press();
    const note = await screen.findByRole("alert");
    const cls = note.className.split(/\s+/);
    for (const c of ["block", "border", "border-line-soft", "bg-situation-bg", "text-vermilion"]) {
      expect(cls).toContain(c);
    }
    expect(cls).not.toContain("text-2xs");
  });

  it("등기대장 결과 표시는 그대로다 — 실패면 작은 줄로 함께 남는다", async () => {
    confirmResult.value = {
      ok: true,
      outcome: {
        ledger: { status: "failed", error: "시트 잠김" },
        pettyCash: { status: "failed", error: REASON },
      },
    };
    await press();
    const ledger = await screen.findByText(/등기대장 — 시트 잠김/);
    expect(ledger.className).toMatch(/text-2xs/);
    expect(ledger.className).toMatch(/vermilion/);
    expect(screen.getByRole("alert").textContent).toContain(REASON);
  });

  it("전도금이 건너뜀이면 경고 블록을 띄우지 않는다 — 대개 정상이다", async () => {
    confirmResult.value = {
      ok: true,
      outcome: {
        ledger: { status: "written" },
        pettyCash: { status: "skipped", reason: "합계가 0원이라 적지 않았습니다" },
      },
    };
    await press();
    await screen.findByText(/전도금대장 — 합계가 0원이라 적지 않았습니다/);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
