import { describe, it, expect, vi } from "vitest";
import {
  emitOpsWeeklyEvent,
  OPS_WEEKLY_HOOKS,
  type OpsWeeklyEvent,
} from "../events";

const EV: OpsWeeklyEvent = {
  type: "all-submitted",
  weekId: "w1",
  weekStart: "2026-11-16",
  dutyEmail: null,
};

describe("emitOpsWeeklyEvent", () => {
  it("A1 은 훅이 비어 있다 — 아무것도 보내지 않는다", () => {
    expect(OPS_WEEKLY_HOOKS).toHaveLength(0);
  });

  it("훅이 없으면 빈 결과로 조용히 끝난다", async () => {
    expect(await emitOpsWeeklyEvent(EV)).toEqual([]);
  });

  it("한 훅이 던져도 나머지는 돈다", async () => {
    const ok = vi.fn(async () => {});
    const out = await emitOpsWeeklyEvent(EV, [
      {
        name: "bad",
        handle: async () => {
          throw new Error("x");
        },
      },
      { name: "good", handle: ok },
    ]);
    expect(out).toEqual([
      { name: "bad", ok: false, error: "x" },
      { name: "good", ok: true },
    ]);
    expect(ok).toHaveBeenCalledWith(EV);
  });

  it("Error 가 아닌 값을 던져도 문자열로 남긴다", async () => {
    const out = await emitOpsWeeklyEvent(EV, [
      {
        name: "odd",
        handle: async () => {
          throw "boom";
        },
      },
    ]);
    expect(out).toEqual([{ name: "odd", ok: false, error: "boom" }]);
  });
});
