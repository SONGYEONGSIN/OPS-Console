import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ListRow } from "../../../patterns/ListPattern";
import { CohortView } from "../../list-variants/cohort/View";
import { CohortForm } from "../../list-variants/cohort/EditForm";
import { CohortTable } from "../../list-variants/cohort/Table";

const baseRow: ListRow = {
  id: "cohort-001",
  name: "2026 Q2 신입 — 김지나",
  status: "active",
  owner: "박현주",
  startDate: "2026-04-01",
  endDate: "2026-06-30",
  cohortStatus: "in_progress",
  traineeEmail: "trainee.external@example.com",
  mentorEmail: null,
};

describe("CohortView", () => {
  it("회차 정보 — 기간 + 상태 라벨 표시", () => {
    render(<CohortView row={baseRow} />);
    expect(screen.getByText("2026-04-01 ~ 2026-06-30")).toBeInTheDocument();
    expect(screen.getByText("진행중")).toBeInTheDocument();
  });

  it("초대 워크플로 — 초대 전 안내 표시", () => {
    render(<CohortView row={baseRow} />);
    expect(screen.getByText("미초대")).toBeInTheDocument();
    expect(
      screen.getByText(/아직 초대 메일을 발송하지 않았습니다/),
    ).toBeInTheDocument();
  });

  it("초대 완료 — 수락 라벨로 전환", () => {
    render(
      <CohortView
        row={{
          ...baseRow,
          invitedAt: "2026-04-15T01:00:00Z",
          acceptedAt: "2026-04-16T02:00:00Z",
        }}
      />,
    );
    expect(screen.getByText("수락 완료")).toBeInTheDocument();
  });

  it("외부 이메일 신입 — operators 시드에 없음 안내", () => {
    render(<CohortView row={baseRow} />);
    expect(screen.getByText(/외부 이메일/)).toBeInTheDocument();
  });

  it("온보딩 체크리스트 섹션 — 진행도 패널 표시", () => {
    render(<CohortView row={baseRow} />);
    expect(screen.getByText("온보딩 체크리스트")).toBeInTheDocument();
    expect(screen.getByText("진행도")).toBeInTheDocument();
  });

  it("체크리스트 토글 — canToggleChecklist=true면 onChecklistToggle 호출", async () => {
    const onChecklistToggle = vi.fn().mockResolvedValue({ ok: true });
    render(
      <CohortView
        row={{ ...baseRow, canToggleChecklist: true, checklistChecks: {} }}
        onChecklistToggle={onChecklistToggle}
      />,
    );
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes[0]).not.toBeDisabled();
    fireEvent.click(boxes[0]);
    await waitFor(() => expect(onChecklistToggle).toHaveBeenCalledTimes(1));
  });
});

describe("CohortForm", () => {
  it("기본 필드 — 제목 / 신입 / 교육 / 시작일 / 종료일 / 상태 / 비고", () => {
    render(
      <CohortForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("제목")).toHaveValue(baseRow.name);
    expect(screen.getByLabelText("신입")).toBeInTheDocument();
    expect(screen.getByLabelText("교육")).toBeInTheDocument();
    expect(screen.getByLabelText("시작일")).toHaveValue("2026-04-01");
    expect(screen.getByLabelText("종료일")).toHaveValue("2026-06-30");
    expect(screen.getByLabelText("상태")).toHaveValue("in_progress");
    expect(screen.getByLabelText("비고")).toBeInTheDocument();
  });

  it("저장 — onSave(row) 호출", () => {
    const onSave = vi.fn();
    render(
      <CohortForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith(baseRow);
  });

  it("취소 — onCancel 호출", () => {
    const onCancel = vi.fn();
    render(
      <CohortForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("초대 버튼 — onInvite 콜백 호출", async () => {
    const onInvite = vi.fn().mockResolvedValue({ ok: true });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(
      <CohortForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onInvite={onInvite}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /초대 메일 발송/ }));
    await new Promise((r) => setTimeout(r, 0));
    expect(onInvite).toHaveBeenCalledWith("cohort-001");
    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it("재초대 — invitedAt 존재 시 라벨 전환", () => {
    render(
      <CohortForm
        row={{ ...baseRow, invitedAt: "2026-04-15T01:00:00Z" }}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onInvite={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "재초대 메일 발송" }),
    ).toBeInTheDocument();
  });

  it("삭제 — onSave({...row, status: deleted}) 호출", () => {
    const onSave = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <CohortForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onSave).toHaveBeenCalledWith({ ...baseRow, status: "deleted" });
    confirmSpy.mockRestore();
  });
});

describe("CohortTable", () => {
  it("헤더 4개 — 제목 / 신입·교육 / 기간 / 상태", () => {
    render(
      <CohortTable rows={[baseRow]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("제목")).toBeInTheDocument();
    expect(screen.getByText("신입 / 교육")).toBeInTheDocument();
    expect(screen.getByText("기간")).toBeInTheDocument();
    expect(screen.getByText("상태")).toBeInTheDocument();
  });

  it("빈 rows — 데이터 없음 안내", () => {
    render(<CohortTable rows={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();
  });

  it("상태 + invite 뱃지 표시", () => {
    render(
      <CohortTable rows={[baseRow]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("진행중")).toBeInTheDocument();
    expect(screen.getByText("미초대")).toBeInTheDocument();
  });

  it("row 클릭 — onSelect(row) 호출", () => {
    const onSelect = vi.fn();
    render(
      <CohortTable rows={[baseRow]} selectedId={null} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByText(baseRow.name));
    expect(onSelect).toHaveBeenCalledWith(baseRow);
  });
});
