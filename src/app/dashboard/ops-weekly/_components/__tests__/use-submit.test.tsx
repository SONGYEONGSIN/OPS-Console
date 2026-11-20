import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
const submitReport = vi.fn();
vi.mock("@/features/ops-weekly/workflow-actions", () => ({
  submitReport: (...a: unknown[]) => submitReport(...a),
}));

import { COMMITTED_PREFIX, useSubmit } from "../use-submit";

beforeEach(() => {
  refresh.mockReset();
  submitReport.mockReset();
});

describe("useSubmit", () => {
  it("reportId 가 없으면 제출하지 않는다", async () => {
    const { result } = renderHook(() => useSubmit(null));
    await act(async () => {
      await result.current.submit();
    });
    expect(submitReport).not.toHaveBeenCalled();
  });

  it("제출하고 새로고침한다", async () => {
    submitReport.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useSubmit("r1"));
    await act(async () => {
      await result.current.submit();
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(submitReport).toHaveBeenCalledWith({ reportId: "r1" });
    expect(result.current.message).toBeNull();
  });

  it("후속 실패 문구의 머리말은 '제출은 끝났지만'", () => {
    expect(COMMITTED_PREFIX).toBe("제출은 끝났지만");
  });
});
