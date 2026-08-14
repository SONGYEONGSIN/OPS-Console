import { describe, it, expect } from "vitest";
import { buildEntertestTargetUrl } from "../target-url";

describe("buildEntertestTargetUrl — 접수구분별 테스트 시스템 호스트", () => {
  it("공통원서는 nstest로 만든다", () => {
    expect(buildEntertestTargetUrl(1130058, "공통원서")).toBe(
      "https://nstest.jinhakapply.com/Notice/1130058/A",
    );
  });

  it("반응형원서는 entertest로 만든다", () => {
    expect(buildEntertestTargetUrl(1130058, "반응형원서")).toBe(
      "https://entertest.jinhakapply.com/Notice/1130058/A",
    );
  });

  it("일반접수는 entertest로 만든다", () => {
    // 21건뿐인 소수 분류 — 반응형과 같은 시스템으로 둔다(운영 확인).
    expect(buildEntertestTargetUrl(1130058, "일반접수")).toBe(
      "https://entertest.jinhakapply.com/Notice/1130058/A",
    );
  });

  it("접수구분이 비어 있으면 entertest로 만든다", () => {
    // closing_services는 매일 덮어써서 분류가 빌 수 있다. 다수(반응형) 쪽으로.
    expect(buildEntertestTargetUrl(1130058, null)).toBe(
      "https://entertest.jinhakapply.com/Notice/1130058/A",
    );
    expect(buildEntertestTargetUrl(1130058, "  ")).toBe(
      "https://entertest.jinhakapply.com/Notice/1130058/A",
    );
  });

  it("공통원서 앞뒤 공백은 무시한다", () => {
    expect(buildEntertestTargetUrl(1130058, " 공통원서 ")).toBe(
      "https://nstest.jinhakapply.com/Notice/1130058/A",
    );
  });
});
