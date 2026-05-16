import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { HandoverForm } from "../HandoverForm";

const useSearchParamsMock = vi.fn(() => new URLSearchParams());
const routerRefresh = vi.fn();
const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => useSearchParamsMock(),
  useRouter: () => ({ refresh: routerRefresh, push: routerPush }),
}));

const upsertMock = vi.fn();
vi.mock("@/features/handover/actions", () => ({
  upsertHandoverRecord: (...args: unknown[]) => upsertMock(...args),
}));

const SERVICE_ID = "aaaaaaaa-1111-4111-8111-111111111111";

function emptyInitial() {
  return {
    contract_info_md: null,
    contract_data_md: null,
    work_basic_md: null,
    work_generator_md: null,
    work_site_md: null,
    work_output_md: null,
    work_rate_md: null,
    work_file_md: null,
    work_etc_md: null,
    payment_fee_md: null,
    payment_invoice_md: null,
    school_contact_md: null,
    docs_md: null,
    notes_md: null,
  };
}

describe("HandoverForm", () => {
  beforeEach(() => {
    upsertMock.mockReset();
    routerRefresh.mockReset();
    routerPush.mockReset();
  });

  it("default 카테고리(계약) — 2 필드 노출", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<HandoverForm serviceId={SERVICE_ID} initial={emptyInitial()} />);
    expect(screen.getByLabelText("계약정보")).toBeInTheDocument();
    expect(screen.getByLabelText("계약자료")).toBeInTheDocument();
    expect(screen.queryByLabelText("기초작업")).toBeNull();
  });

  it("?cat=work — 7 필드 노출", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("cat=work"));
    render(<HandoverForm serviceId={SERVICE_ID} initial={emptyInitial()} />);
    expect(screen.getByLabelText("기초작업")).toBeInTheDocument();
    expect(screen.getByLabelText("생성툴")).toBeInTheDocument();
    expect(screen.getByLabelText("사이트·페이지")).toBeInTheDocument();
    expect(screen.getByLabelText("출력물")).toBeInTheDocument();
    expect(screen.getByLabelText("경쟁률")).toBeInTheDocument();
    expect(screen.getByLabelText("전산파일")).toBeInTheDocument();
    expect(screen.queryByLabelText("계약정보")).toBeNull();
  });

  it("초기 상태 — 저장 버튼 disabled (dirty=false)", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<HandoverForm serviceId={SERVICE_ID} initial={emptyInitial()} />);
    expect(
      (screen.getByRole("button", { name: /저장/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("textarea 변경 시 dirty=true + 저장 enabled", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<HandoverForm serviceId={SERVICE_ID} initial={emptyInitial()} />);
    fireEvent.change(screen.getByLabelText("계약정보"), {
      target: { value: "정보" },
    });
    expect(
      (screen.getByRole("button", { name: /저장/ }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("저장 클릭 → upsertHandoverRecord 호출 (service_id + 14 필드)", async () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    upsertMock.mockResolvedValue({ ok: true, row: {} });
    render(<HandoverForm serviceId={SERVICE_ID} initial={emptyInitial()} />);

    fireEvent.change(screen.getByLabelText("계약정보"), {
      target: { value: "정보" },
    });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() => expect(upsertMock).toHaveBeenCalledOnce());
    const payload = upsertMock.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      service_id: SERVICE_ID,
      contract_info_md: "정보",
      contract_data_md: null,
      work_basic_md: null,
    });
  });

  it("취소 클릭 → /dashboard/handover로 push", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<HandoverForm serviceId={SERVICE_ID} initial={emptyInitial()} />);
    fireEvent.click(screen.getByRole("button", { name: /취소/ }));
    expect(routerPush).toHaveBeenCalledWith("/dashboard/handover");
  });
});
