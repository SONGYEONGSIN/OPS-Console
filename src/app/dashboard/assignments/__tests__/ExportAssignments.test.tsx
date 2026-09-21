import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const runAssignmentExport = vi.hoisted(() => vi.fn());
vi.mock("@/features/assignments/export-actions", () => ({ runAssignmentExport }));

import { ExportAssignments } from "../ExportAssignments";

/** 확인 단계의 실행 버튼 — 여는 버튼(`시트 내보내기`)과 이름이 달라야 구분된다. */
const confirmButton = () => screen.getByRole("button", { name: "내보내기" });
const openButton = () => screen.getByRole("button", { name: "시트 내보내기" });

beforeEach(() => {
  vi.clearAllMocks();
  runAssignmentExport.mockResolvedValue({
    ok: true,
    message: "배정확정 시트에 400행 × 24열을 썼습니다 (반영까지 1~2분 걸립니다)",
  });
});

describe("ExportAssignments", () => {
  it("누르기 전에는 액션을 부르지 않는다", () => {
    render(<ExportAssignments />);
    expect(runAssignmentExport).not.toHaveBeenCalled();
  });

  it("**한 번 더 묻는다** — 사람이 보는 파일을 덮어쓰는 버튼이다", () => {
    render(<ExportAssignments />);

    fireEvent.click(openButton());

    // 확인 단계가 떴는데 아직 쓰지 않았어야 한다.
    expect(runAssignmentExport).not.toHaveBeenCalled();
    expect(screen.getByText(/통째로 다시\s*씁니다/)).toBeInTheDocument();
  });

  it("확인 문구가 사라지는 것이 무엇인지 말한다", () => {
    render(<ExportAssignments />);
    fireEvent.click(openButton());

    // '덮어쓴다' 만으로는 사람이 02 시트를 걱정한다. 범위를 적어야 한다.
    expect(screen.getByText(/직접 적은 내용은 사라집니다/)).toBeInTheDocument();
    expect(screen.getByText(/02~08 시트는 건드리지 않습니다/)).toBeInTheDocument();
  });

  it("확인하면 실행하고 결과 문장을 그대로 보여준다", async () => {
    render(<ExportAssignments />);

    fireEvent.click(openButton());
    fireEvent.click(confirmButton());

    await waitFor(() => expect(runAssignmentExport).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/400행/)).toBeInTheDocument();
  });

  it("취소하면 부르지 않는다", () => {
    render(<ExportAssignments />);

    fireEvent.click(openButton());
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(runAssignmentExport).not.toHaveBeenCalled();
    expect(screen.queryByText(/통째로 다시\s*씁니다/)).not.toBeInTheDocument();
  });

  it("실패 사유를 요약하지 않는다 — 왜 안 됐는지가 곧 조치다", async () => {
    runAssignmentExport.mockResolvedValue({
      ok: false,
      message: "원장이 비어 있습니다 — 시트를 통째로 비우지 않습니다",
    });
    render(<ExportAssignments />);

    fireEvent.click(openButton());
    fireEvent.click(confirmButton());

    expect(
      await screen.findByText(/원장이 비어 있습니다/),
    ).toBeInTheDocument();
  });
});
