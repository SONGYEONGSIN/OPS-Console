import { describe, expect, it } from "vitest";
import { DEV_STAGES, freshDevStages, stageFromMoa } from "../dev-status";

describe("freshDevStages", () => {
  it("그 주에 수집된 구분만 남긴다", () => {
    const m = freshDevStages(
      [{ service_id: 4, stage: "test", collected_at: "2026-11-16T00:00:00Z" }],
      "2026-11-16",
    );
    expect(m.get(4)).toBe("test");
  });
  it("지난주(일 23:00 KST)에 수집된 구분은 미확인", () => {
    expect(
      freshDevStages(
        [{ service_id: 4, stage: "dev", collected_at: "2026-11-15T14:00:00Z" }],
        "2026-11-16",
      ).size,
    ).toBe(0);
  });
  it("월 00:00 KST 정각은 그 주다", () => {
    expect(
      freshDevStages(
        [{ service_id: 4, stage: "dev", collected_at: "2026-11-15T15:00:00Z" }],
        "2026-11-16",
      ).size,
    ).toBe(1);
  });
  it("구분은 dev·test·deployed 셋", () => {
    expect([...DEV_STAGES]).toEqual(["dev", "test", "deployed"]);
  });
  it("deployed 도 그 주에 수집됐으면 남는다", () => {
    const m = freshDevStages(
      [{ service_id: 5, stage: "deployed", collected_at: "2026-11-16T00:00:00Z" }],
      "2026-11-16",
    );
    expect(m.get(5)).toBe("deployed");
  });
});

describe("stageFromMoa", () => {
  const T = "2026-11-10 14:00:00";
  const R = "2026-11-12 09:00:00";
  it("리얼배포가 '-' 면 테스트 오픈으로 가른다 — '-' 면 dev, 일시면 test", () => {
    expect(stageFromMoa({ test_open: "-", real_deploy: "-" })).toBe("dev");
    expect(stageFromMoa({ test_open: T, real_deploy: "-" })).toBe("test");
  });
  it("리얼배포 일시가 있으면 테스트 오픈과 무관하게 deployed", () => {
    expect(stageFromMoa({ test_open: T, real_deploy: R })).toBe("deployed");
    expect(stageFromMoa({ test_open: "-", real_deploy: R })).toBe("deployed");
  });
});
