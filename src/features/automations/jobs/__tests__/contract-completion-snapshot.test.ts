import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/features/contracts/completion-snapshot", () => ({
  countCompletedContracts: vi.fn(),
  upsertCompletionSnapshot: vi.fn(),
  kstYm: vi.fn(() => "2026-07"),
}));

import {
  countCompletedContracts,
  upsertCompletionSnapshot,
} from "@/features/contracts/completion-snapshot";
import { runContractCompletionSnapshot } from "../contract-completion-snapshot";

beforeEach(() => vi.resetAllMocks());

describe("runContractCompletionSnapshot", () => {
  it("현재 완료 건수를 현재 월 스냅샷으로 upsert", async () => {
    vi.mocked(countCompletedContracts).mockResolvedValue(33);
    const r = await runContractCompletionSnapshot();
    expect(upsertCompletionSnapshot).toHaveBeenCalledWith("2026-07", 33);
    expect(r.ok).toBe(true);
    expect(r.details?.completed).toBe(33);
  });

  it("실패 시 ok:false", async () => {
    vi.mocked(countCompletedContracts).mockRejectedValue(new Error("boom"));
    const r = await runContractCompletionSnapshot();
    expect(r.ok).toBe(false);
  });
});
