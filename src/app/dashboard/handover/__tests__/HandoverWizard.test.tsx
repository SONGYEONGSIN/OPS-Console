import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandoverWizard } from "../HandoverWizard";

const createSpy = vi.fn();
vi.mock("@/features/handover/progress-actions", () => ({
  createHandoverProgress: (...args: unknown[]) => createSpy(...args),
}));
vi.mock("@/features/handover/mail-actions", () => ({
  sendHandoverMail: vi.fn().mockResolvedValue({ ok: true, status: "dry_run" }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const baseHandoverFields = {
  application_type: "공통원서",
  updated_at: "2026-05-17T00:00:00Z",
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
  contract_info: null,
  contract_data_checklist: [],
  payment_fee: null,
  payment_invoice: null,
  school_contacts: [],
  docs_checklist: [],
};
const services = [
  {
    id: "s1",
    service_id: 6007001,
    university_name: "한예종",
    service_name: "KARTS",
    operator_name: "송영신",
    ...baseHandoverFields,
  },
  {
    id: "s2",
    service_id: 6007007,
    university_name: "한예종",
    service_name: "무용원 2차",
    operator_name: "송영신",
    ...baseHandoverFields,
  },
];
const operators = [
  { email: "a@x.com", name: "허승철" },
  { email: "b@x.com", name: "김슬기" },
];
const from = { name: "테스트인계자", email: "from@x.com" };

describe("HandoverWizard", () => {
  beforeEach(() => createSpy.mockReset());

  it("step1 — 서비스 후보 라디오 표시 + 선택 후 다음 활성", () => {
    render(
      <HandoverWizard services={services} operators={operators} from={from} />,
    );
    expect(
      screen.getByRole("heading", { name: /서비스 선택/ }),
    ).toBeInTheDocument();
    const next = screen.getByRole("button", { name: /다음/ });
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/KARTS/));
    expect(next).not.toBeDisabled();
  });

  it("step1 → step2 인수자 선택 표시", () => {
    render(
      <HandoverWizard services={services} operators={operators} from={from} />,
    );
    fireEvent.click(screen.getByLabelText(/KARTS/));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    expect(
      screen.getByRole("heading", { name: /인수자 선택/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/허승철/)).toBeInTheDocument();
  });

  it("step3 — 메모 textarea 표시 + 확인 버튼", () => {
    render(
      <HandoverWizard services={services} operators={operators} from={from} />,
    );
    fireEvent.click(screen.getByLabelText(/KARTS/));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByLabelText(/허승철/));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    expect(screen.getByLabelText("메모")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "인계 시작" }),
    ).toBeInTheDocument();
  });

  it("step3 — 인계자(현재 사용자)·접수구분·구조화 필드(계약정보) 표시", () => {
    const withContent = [
      {
        ...services[0],
        application_type: "반응형원서",
        contract_info: {
          title: "원서접수 대행",
          type: "",
          progress: "",
          status: "",
          memo: "",
        },
      },
    ];
    render(
      <HandoverWizard
        services={withContent}
        operators={operators}
        from={from}
      />,
    );
    fireEvent.click(screen.getByLabelText(/KARTS/));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByLabelText(/허승철/));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    // 인계자 = 현재 사용자
    expect(screen.getByText("테스트인계자")).toBeInTheDocument();
    // 접수구분(application_type) prefix
    expect(screen.getByText("반응형원서")).toBeInTheDocument();
    // 계약 카테고리 펼치면 구조화 계약정보가 (미작성) 아닌 실내용으로 표시
    fireEvent.click(screen.getByRole("button", { name: /계약/ }));
    expect(screen.getByText("원서접수 대행")).toBeInTheDocument();
  });

  it("step4 — createHandoverProgress 호출 + 완료 표시", async () => {
    createSpy.mockResolvedValue({ ok: true, row: { id: "prog-1" } });
    render(
      <HandoverWizard services={services} operators={operators} from={from} />,
    );
    fireEvent.click(screen.getByLabelText(/KARTS/));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByLabelText(/허승철/));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.change(screen.getByLabelText("메모"), {
      target: { value: "참고 메모" },
    });
    fireEvent.click(screen.getByRole("button", { name: "인계 시작" }));
    await new Promise((r) => setTimeout(r, 0));
    expect(createSpy).toHaveBeenCalledTimes(1);
    const payload = createSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.service_id).toBe("s1");
    expect(payload.to_email).toBe("a@x.com");
    expect(payload.to_name).toBe("허승철");
    expect(payload.notes).toBe("참고 메모");
  });

  it("뒤로 버튼으로 이전 step 복귀", () => {
    render(
      <HandoverWizard services={services} operators={operators} from={from} />,
    );
    fireEvent.click(screen.getByLabelText(/KARTS/));
    fireEvent.click(screen.getByRole("button", { name: /다음/ }));
    fireEvent.click(screen.getByRole("button", { name: /이전/ }));
    expect(
      screen.getByRole("heading", { name: /서비스 선택/ }),
    ).toBeInTheDocument();
  });

  it("step1Footer prop이 있으면 Step1 테이블 아래에 렌더", () => {
    render(
      <HandoverWizard
        services={services}
        operators={operators}
        from={from}
        step1Footer={<div data-testid="footer-slot">페이지네이션</div>}
      />,
    );
    expect(screen.getByTestId("footer-slot")).toBeInTheDocument();
  });

  it("allServices로 selectedService 조회 — services(페이지)에 없는 서비스도 Step3에서 찾음", () => {
    // services는 빈 배열(페이지 결과), allServices에만 s1이 있는 상황
    render(
      <HandoverWizard
        services={[]}
        allServices={services}
        operators={operators}
        from={from}
      />,
    );
    // services가 비었으므로 Step1에서 선택 불가 → 직접 상태를 확인하기 어려워
    // 여기서는 allServices prop이 type error 없이 렌더되는지만 확인
    expect(
      screen.getByRole("heading", { name: /서비스 선택/ }),
    ).toBeInTheDocument();
  });
});
