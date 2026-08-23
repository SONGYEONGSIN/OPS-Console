import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { SettlementTableRow } from "../SettlementTable";

const { setSpy, doneSpy, result, doneResult } = vi.hoisted(() => ({
  setSpy: vi.fn(),
  doneSpy: vi.fn(),
  result: { value: { ok: true } as unknown },
  doneResult: { value: { ok: true } as unknown },
}));
vi.mock("@/features/settlement/actions", () => ({
  setSettlementDeadline: (...a: unknown[]) => {
    setSpy(...a);
    return Promise.resolve(result.value);
  },
  setSettlementCompleted: (...a: unknown[]) => {
    doneSpy(...a);
    return Promise.resolve(doneResult.value);
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { SettlementTable } = await import("../SettlementTable");

const row = (over: Record<string, unknown> = {}): SettlementTableRow =>
  ({
    id: "1",
    service_id: 100,
    settledAt: null,
    issuedAt: null,
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
    doneSpy.mockClear();
    result.value = { ok: true };
    doneResult.value = { ok: true };
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

/**
 * 정산완료 체크 — 이 메뉴가 처음으로 "무엇이 남았는지"를 말하게 하는 칸이다.
 *
 * 완료한 줄을 **숨기지 않는다.** 잘못 체크했을 때 되돌릴 자리가 사라지고,
 * 아직 계산서 발행이 남아 있어 목록에서 지울 대상도 아니다.
 */
describe("SettlementTable — 정산완료", () => {
  beforeEach(() => {
    doneSpy.mockClear();
    doneResult.value = { ok: true };
  });

  it("체크하면 서비스ID 와 함께 완료로 보낸다", async () => {
    render(<SettlementTable rows={[row()]} />);
    fireEvent.click(screen.getByLabelText(/정산완료/));
    await waitFor(() => expect(doneSpy).toHaveBeenCalledWith(100, true));
  });

  it("이미 완료된 줄은 체크돼 있고 다시 누르면 해제로 보낸다", async () => {
    render(<SettlementTable rows={[row({ settledAt: "2026-08-24T01:00:00Z" })]} />);
    const box = screen.getByLabelText(/정산완료/) as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    await waitFor(() => expect(doneSpy).toHaveBeenCalledWith(100, false));
  });

  it("완료한 줄도 목록에 남는다 — 되돌릴 자리가 있어야 한다", () => {
    render(<SettlementTable rows={[row({ settledAt: "2026-08-24T01:00:00Z" })]} />);
    expect(screen.getByText("충청대학교")).toBeInTheDocument();
  });

  it("완료한 줄은 톤을 낮춰 미완료와 구분한다", () => {
    render(<SettlementTable rows={[row({ settledAt: "2026-08-24T01:00:00Z" })]} />);
    expect(screen.getByText("충청대학교").className).toContain("text-muted");
  });

  it("미완료 줄은 톤을 낮추지 않는다", () => {
    render(<SettlementTable rows={[row()]} />);
    expect(screen.getByText("충청대학교").className).toContain("text-ink");
    expect(screen.getByText("충청대학교").className).not.toContain("text-muted");
  });

  it("거절당하면 그 자리에 이유를 띄운다 — 남의 담당 건일 때", async () => {
    doneResult.value = { ok: false, error: "본인이 담당한 서비스만 표시할 수 있습니다" };
    render(<SettlementTable rows={[row()]} />);
    fireEvent.click(screen.getByLabelText(/정산완료/));
    await waitFor(() =>
      expect(screen.getByText(/본인이 담당한 서비스만/)).toBeInTheDocument(),
    );
  });
});
