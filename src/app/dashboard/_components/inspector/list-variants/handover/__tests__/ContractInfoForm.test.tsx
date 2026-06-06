import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContractInfoForm } from "../ContractInfoForm";
import type { ContractInfo } from "@/features/handover/schemas";

const searchMock = vi.fn();
vi.mock("@/features/contracts/actions", () => ({
  searchContractsByUniversity: (name: string) => searchMock(name),
}));

const value: ContractInfo = {
  title: "원서접수",
  type: "수의",
  progress: "운영자",
  status: "완료",
  memo: "※ 학부 계약시 포함",
};

describe("ContractInfoForm", () => {
  it("readOnly — 제목/형태/진행/상태/메모 값 표시", () => {
    render(<ContractInfoForm value={value} readOnly />);
    expect(screen.getByText("원서접수")).toBeInTheDocument();
    expect(screen.getByText("수의")).toBeInTheDocument();
    expect(screen.getByText("운영자")).toBeInTheDocument();
    expect(screen.getByText("완료")).toBeInTheDocument();
    expect(screen.getByText("※ 학부 계약시 포함")).toBeInTheDocument();
  });

  it("편집 — 형태 입력 시 onChange로 갱신", () => {
    const onChange = vi.fn();
    render(<ContractInfoForm value={value} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("형태"), {
      target: { value: "공개" },
    });
    expect(onChange.mock.calls[0][0]).toMatchObject({ type: "공개" });
  });

  it("편집 — 메모 입력 시 onChange로 갱신", () => {
    const onChange = vi.fn();
    render(<ContractInfoForm value={value} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("계약정보 메모"), {
      target: { value: "변경 메모" },
    });
    expect(onChange.mock.calls[0][0]).toMatchObject({ memo: "변경 메모" });
  });

  it("readOnly — 입력 필드 없음", () => {
    render(<ContractInfoForm value={value} readOnly />);
    expect(screen.queryByLabelText("형태")).toBeNull();
  });

  it("계약에서 가져오기 → 진행/상태 자동 채움", async () => {
    searchMock.mockResolvedValue({
      ok: true,
      matches: [
        {
          sheet: "4년제",
          numbering: "D-1-01",
          name: "건국대학교",
          operator: "송영신",
          status: "계약완료",
          feeAmount: "",
        },
      ],
    });
    const onChange = vi.fn();
    const empty: ContractInfo = {
      title: "",
      type: "",
      progress: "",
      status: "",
      memo: "",
    };
    render(
      <ContractInfoForm
        value={empty}
        onChange={onChange}
        universityName="건국대학교"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /불러오기/ }));
    const pick = await screen.findByRole("button", { name: /건국대학교/ });
    fireEvent.click(pick);
    // 계약완료(영업팀진행/입찰 아님) → 진행 운영 / 형태 수의 / 제목 원서접수
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "원서접수",
        type: "수의",
        progress: "운영",
        status: "계약완료",
      }),
    );
  });

  it("universityName 없으면 검색 버튼 미표시", () => {
    render(<ContractInfoForm value={value} onChange={vi.fn()} />);
    expect(
      screen.queryByRole("button", { name: /불러오기/ }),
    ).toBeNull();
  });
});
