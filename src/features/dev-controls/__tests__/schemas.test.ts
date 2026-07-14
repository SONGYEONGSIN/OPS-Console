import { describe, it, expect } from "vitest";
import { devControlFlagSchema } from "../schemas";

const validFlag = {
  key: "k1",
  label: "지난 연도 날짜",
  snippet: "2025. 9. 9.",
  severity: "warn",
  checked: false,
  note: "",
};

describe("dev-controls/schemas — devControlFlagSchema", () => {
  it("정상 flag 파싱 통과", () => {
    expect(() => devControlFlagSchema.parse(validFlag)).not.toThrow();
  });

  it("잘못된 severity는 거부", () => {
    expect(() =>
      devControlFlagSchema.parse({ ...validFlag, severity: "critical" }),
    ).toThrow();
  });
});
