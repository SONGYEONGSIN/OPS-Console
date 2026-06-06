import { describe, it, expect } from "vitest";
import { HANDOVER_FIELD_KEYS } from "../categories";
import { FIELD_EXAMPLE } from "../field-examples";

describe("FIELD_EXAMPLE (부산대 일반편입학 예시 placeholder)", () => {
  it("14개 필드 키를 모두 포함", () => {
    for (const key of HANDOVER_FIELD_KEYS) {
      expect(FIELD_EXAMPLE[key]).toBeTypeOf("string");
      expect(FIELD_EXAMPLE[key].length).toBeGreaterThan(0);
    }
  });
  it("계약정보 예시는 부산대 원서접수 내용", () => {
    expect(FIELD_EXAMPLE.contract_info_md).toContain("원서접수");
  });
});
