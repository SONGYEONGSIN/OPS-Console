import { describe, expect, it } from "vitest";
import { DEV_STAGES, freshDevStages, stageFromTestOpen } from "../dev-status";

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
  it("구분은 dev·test 둘", () => {
    expect([...DEV_STAGES]).toEqual(["dev", "test"]);
  });
});

describe("stageFromTestOpen", () => {
  it("테스트 오픈이 '-' 면 dev, 일시면 test", () => {
    expect(stageFromTestOpen("-")).toBe("dev");
    expect(stageFromTestOpen("2026-11-10 14:00:00")).toBe("test");
  });
});
