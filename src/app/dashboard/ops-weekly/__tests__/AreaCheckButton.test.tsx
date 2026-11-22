import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const markTabChecked = vi.fn();
vi.mock("@/features/ops-weekly/actions", () => ({
  markTabChecked: (...a: unknown[]) => markTabChecked(...a),
}));

import { AreaCheckButton } from "../_components/AreaCheckButton";

beforeEach(() => {
  markTabChecked.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe("AreaCheckButton — 영역 탭 줄의 [이 영역 확인]", () => {
  it("누르면 그 영역을 확인한다", async () => {
    render(<AreaCheckButton reportId="r" area="pims" checked={false} />);
    fireEvent.click(screen.getByRole("button", { name: "이 영역 확인" }));
    await waitFor(() =>
      expect(markTabChecked).toHaveBeenCalledWith({ reportId: "r", area: "pims" }),
    );
  });
  it("이미 확인했으면 '확인함 ✓' 이고 눌리지 않는다", () => {
    render(<AreaCheckButton reportId="r" area="pims" checked />);
    expect(screen.getByRole("button", { name: "확인함 ✓" })).toBeDisabled();
  });
  it("실패하면 버튼 옆에 문구", async () => {
    markTabChecked.mockResolvedValue({ ok: false, error: "확인 실패" });
    render(<AreaCheckButton reportId="r" area="pims" checked={false} />);
    fireEvent.click(screen.getByRole("button", { name: "이 영역 확인" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("확인 실패"),
    );
  });
});
