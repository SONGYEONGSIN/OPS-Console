import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { SettlementRow } from "@/features/settlement/rows";

const { setSpy, result } = vi.hoisted(() => ({
  setSpy: vi.fn(),
  result: { value: { ok: true } as unknown },
}));
vi.mock("@/features/settlement/actions", () => ({
  setSettlementDeadline: (...a: unknown[]) => {
    setSpy(...a);
    return Promise.resolve(result.value);
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { SettlementTable } = await import("../SettlementTable");

const row = (over: Partial<SettlementRow> = {}): SettlementRow =>
  ({
    id: "1",
    university_name: "충청대학교",
    service_name: "2027 수시",
    operator_name: "김담당",
    pay_end_at: "2026-08-01T00:00:00Z",
    deadlineDays: 10,
    dueAt: "2026-08-11T00:00:00.000Z",
    daysLeft: 5,
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

/**
 * 정산 목록 — 서비스마감과 다른 점은 **정산 마감일과 남은 날**이다.
 * 그게 없으면 같은 목록이므로, 화면이 그걸 드러내야 한다.
 */
describe("SettlementTable", () => {
  beforeEach(() => {
    setSpy.mockClear();
    result.value = { ok: true };
  });

  it("정산 마감일을 보여준다 — 결제마감이 아니라", () => {
    render(<SettlementTable rows={[row()]} />);
    expect(screen.getByText(/08\. 11\./)).toBeInTheDocument();
  });

  it("지난 건은 눈에 띄어야 한다", () => {
    render(<SettlementTable rows={[row({ daysLeft: -3 })]} />);
    const el = screen.getByText(/3일 지남/);
    expect(el.className).toMatch(/vermilion/);
  });

  it("기한이 없으면 '미설정'이라 말한다 — 마감일을 지어내지 않는다", () => {
    render(
      <SettlementTable
        rows={[row({ deadlineDays: null, dueAt: null, daysLeft: null })]}
      />,
    );
    expect(screen.getByText("미설정")).toBeInTheDocument();
    expect(screen.queryByText(/일 지남|D-/)).toBeNull();
  });

  it("기한을 고르면 저장한다 — 대학 단위다", async () => {
    render(<SettlementTable rows={[row({ deadlineDays: null })]} />);
    fireEvent.change(screen.getByLabelText("충청대학교 정산기한"), {
      target: { value: "20" },
    });
    await waitFor(() =>
      expect(setSpy).toHaveBeenCalledWith("충청대학교", 20),
    );
  });

  it("같은 대학이 여러 줄이어도 기한 칸은 각 줄에 있다", () => {
    render(
      <SettlementTable
        rows={[row({ id: "1" }), row({ id: "2", service_name: "정시" })]}
      />,
    );
    expect(screen.getAllByLabelText("충청대학교 정산기한")).toHaveLength(2);
  });

  it("실패하면 사유를 보여준다", async () => {
    result.value = { ok: false, error: "권한이 없습니다" };
    render(<SettlementTable rows={[row({ deadlineDays: null })]} />);
    fireEvent.change(screen.getByLabelText("충청대학교 정산기한"), {
      target: { value: "5" },
    });
    await waitFor(() =>
      expect(screen.getByText("권한이 없습니다")).toBeInTheDocument(),
    );
  });

  it("비어 있으면 그렇다고 말한다", () => {
    render(<SettlementTable rows={[]} />);
    expect(screen.getByText(/정산할 건이 없습니다/)).toBeInTheDocument();
  });
});
