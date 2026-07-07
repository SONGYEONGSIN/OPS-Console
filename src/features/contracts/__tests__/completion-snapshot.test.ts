import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("../queries", () => ({ listContracts: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { listContracts } from "../queries";
import {
  kstYm,
  countCompletedContracts,
  getSnapshotCount,
  upsertCompletionSnapshot,
} from "../completion-snapshot";

beforeEach(() => vi.resetAllMocks());

describe("kstYm", () => {
  it("KST 기준 YYYY-MM", () => {
    // 2026-07-15 03:00 UTC = 2026-07-15 12:00 KST
    expect(kstYm(new Date("2026-07-15T03:00:00Z"))).toBe("2026-07");
    // 2026-06-30 20:00 UTC = 2026-07-01 05:00 KST → 7월
    expect(kstYm(new Date("2026-06-30T20:00:00Z"))).toBe("2026-07");
  });
});

describe("countCompletedContracts", () => {
  it("서비스여부 Y + 완료 상태 행만 카운트", async () => {
    vi.mocked(listContracts).mockResolvedValue({
      rows: [
        { status: "계약완료", serviceActive: "Y" },
        { status: "계약완료(영업)", serviceActive: "Y" },
        { status: "계약완료", serviceActive: "" }, // 서비스여부 미설정 → 제외
        { status: "계약 미완료", serviceActive: "Y" },
        { status: "영업팀진행", serviceActive: "Y" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any,
      total: 5,
    });
    expect(await countCompletedContracts()).toBe(2);
  });

  it("실패 시 0", async () => {
    vi.mocked(listContracts).mockRejectedValue(new Error("fail"));
    expect(await countCompletedContracts()).toBe(0);
  });
});

describe("getSnapshotCount", () => {
  function mockSelect(data: { completed_count: number } | null) {
    const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    vi.mocked(createAdminClient).mockReturnValue({
      from,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    return { from, eq };
  }

  it("존재하면 completed_count 반환", async () => {
    mockSelect({ completed_count: 28 });
    expect(await getSnapshotCount("2026-06")).toBe(28);
  });

  it("없으면 null", async () => {
    mockSelect(null);
    expect(await getSnapshotCount("2026-06")).toBeNull();
  });
});

describe("upsertCompletionSnapshot", () => {
  it("ym onConflict로 upsert 호출", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    vi.mocked(createAdminClient).mockReturnValue({
      from,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    await upsertCompletionSnapshot("2026-07", 33);
    expect(from).toHaveBeenCalledWith("contract_completion_snapshots");
    expect(upsert).toHaveBeenCalledWith(
      { ym: "2026-07", completed_count: 33 },
      { onConflict: "ym" },
    );
  });
});
