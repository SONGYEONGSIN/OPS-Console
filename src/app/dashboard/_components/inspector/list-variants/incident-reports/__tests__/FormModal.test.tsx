import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";

const { mockUpdate } = vi.hoisted(() => ({ mockUpdate: vi.fn() }));
vi.mock("@/features/incident-reports/actions", () => ({
  updateIncidentReport: mockUpdate,
}));

import { FormModal } from "../FormModal";

const row: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "원서 오류",
  status: "active",
  owner: "이해영",
  incidentReportStatus: "draft",
  incidentReportUniversity: "건국대학교",
  incidentReportTitle: "원서 오류",
  incidentReportDraftDate: "2026-06-02",
  incidentReportAuthorName: "이해영",
  incidentReportGyeongwi: "초기 경위",
};

beforeEach(() => vi.clearAllMocks());

describe("FormModal", () => {
  it("open=false면 아무것도 렌더하지 않는다", () => {
    const { container } = render(
      <FormModal open={false} onClose={() => {}} row={row} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("경위 필드를 수정하면 미리보기에 즉시 반영된다", () => {
    render(<FormModal open onClose={() => {}} row={row} />);
    const textarea = screen.getByLabelText("경위");
    fireEvent.change(textarea, { target: { value: "수정된 경위 내용" } });
    // 미리보기 <p>에 반영 확인 — controlled textarea의 value도 jsdom에서
    // 텍스트 노드로 잡히므로, 편집 입력이 아닌 요소(<p>)만 골라낸다.
    const reflected = screen
      .getAllByText("수정된 경위 내용")
      .filter((el) => el.tagName !== "TEXTAREA");
    expect(reflected).toHaveLength(1);
    expect(reflected[0]).toBeInTheDocument();
  });

  it("저장 시 편집값으로 updateIncidentReport를 호출한다", async () => {
    mockUpdate.mockResolvedValue({ ok: true });
    const onSaved = vi.fn();
    render(<FormModal open onClose={() => {}} row={row} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText("원인"), {
      target: { value: "새 원인" },
    });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith(
        row.id,
        expect.objectContaining({ cause: "새 원인" }),
      ),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it("approved 상태면 편집 필드를 노출하지 않는다(읽기 전용)", () => {
    render(
      <FormModal
        open
        onClose={() => {}}
        row={{ ...row, incidentReportStatus: "approved" }}
      />,
    );
    expect(screen.queryByLabelText("경위")).not.toBeInTheDocument();
  });
});
