import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandoverEditForm } from "../EditForm";
import type { ListRow } from "../../../../patterns/ListPattern";

const baseRow: ListRow = {
  id: "service-1",
  name: "서울대학교 · 수시",
  status: "active",
  owner: "송영신",
  universityName: "서울대학교",
  serviceName: "수시 일반전형",
  applicationType: "공통원서",
  handoverStatus: "draft",
  handoverContractInfoMd: "기존 계약정보",
  handoverWorkBasicMd: null,
};

function setup(over: Partial<Parameters<typeof HandoverEditForm>[0]> = {}) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const setRow = vi.fn();
  render(
    <HandoverEditForm
      row={baseRow}
      setRow={setRow}
      onSave={onSave}
      onCancel={onCancel}
      {...over}
    />,
  );
  return { onSave, onCancel, setRow };
}

describe("HandoverEditForm", () => {
  it("카테고리 탭 + 첫 카테고리(계약) 필드 표시 + 기존 값 prefill", () => {
    setup();
    expect(screen.getByRole("button", { name: "계약" })).toBeInTheDocument();
    expect(screen.getByLabelText("계약정보")).toHaveValue("기존 계약정보");
    // 계약자료 = 계약서류 체크리스트 + 메모
    expect(screen.getByText(/계약서류 \(/)).toBeInTheDocument();
    expect(screen.getByLabelText("계약자료 메모")).toBeInTheDocument();
  });

  it("카테고리 탭(작업) 클릭 시 다른 필드 표시", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "작업" }));
    expect(screen.getByLabelText("기초작업")).toBeInTheDocument();
    expect(screen.queryByLabelText("계약정보")).not.toBeInTheDocument();
  });

  it("textarea 입력 시 setRow 호출", () => {
    const { setRow } = setup();
    fireEvent.change(screen.getByLabelText("계약자료 메모"), {
      target: { value: "신규자료" },
    });
    expect(setRow).toHaveBeenCalled();
  });

  it("저장 버튼 클릭 시 onSave(row) 호출", () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith(baseRow);
  });

  it("취소 버튼 클릭 시 onCancel 호출", () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("onCopyHandover 없으면 복제 섹션 미노출", () => {
    setup();
    expect(screen.queryByText("다른 서비스로 복제")).toBeNull();
  });

  it("onCopyHandover 있으면 복제 검색 input 노출", () => {
    setup({ onCopyHandover: vi.fn().mockResolvedValue({ ok: true }) });
    expect(screen.getByText("다른 서비스로 복제")).toBeInTheDocument();
    expect(
      screen.getByLabelText("복제 대상 서비스 검색"),
    ).toBeInTheDocument();
  });

  it("검색 → 후보 선택 → 복제 버튼 클릭 시 onCopyHandover(from, [to]) 호출", async () => {
    const onCopyHandover = vi.fn().mockResolvedValue({ ok: true, copiedCount: 1 });
    render(
      <HandoverEditForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onCopyHandover={onCopyHandover}
        handoverServiceCandidates={[
          {
            id: "service-2",
            serviceId: 1002,
            universityName: "서울대학교",
            serviceName: "수시 2차",
            hasRecord: false,
          },
        ]}
      />,
    );
    fireEvent.change(screen.getByLabelText("복제 대상 서비스 검색"), {
      target: { value: "서울대" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /복제/ }));
    expect(onCopyHandover).toHaveBeenCalledWith("service-1", ["service-2"]);
  });
});
