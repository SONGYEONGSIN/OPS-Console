import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
// 잡이 큐 적재 모듈을 import 하면 안 된다 — 목 없이 바로 부르면 실제 DB 에 닿으므로 import 자체를 막는다.
vi.mock("@/features/ratio-audit/audit-requests/enqueue", () => {
  throw new Error("잡은 큐에 적재하지 않는다");
});

import { RATIO_RUN_NEEDS_CONDITIONS } from "@/features/ratio-audit/run-filters";
import { runRatioAudit } from "../ratio-audit";

describe("runRatioAudit", () => {
  it("조건 없이 적재하지 않는다 — 조건 창에서만 실행", async () => {
    const r = await runRatioAudit();
    expect(r).toEqual({
      ok: false,
      // 일부러 안 돈 것 — 실패로 기록되면 Teams 알림이 나가고 이후 진짜 실패 알림이 억제된다.
      skipped: true,
      message: RATIO_RUN_NEEDS_CONDITIONS,
    });
  });
});
