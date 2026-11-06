import { describe, expect, it } from "vitest";
import { mailErrorCode } from "../mail-error-code";

describe("mailErrorCode", () => {
  it("`코드: 본문` 이면 코드만", () => {
    expect(mailErrorCode("graph_403: body")).toBe("graph_403");
  });
  it("형식이 아니면 send_failed", () => {
    expect(mailErrorCode("boom")).toBe("send_failed");
    expect(mailErrorCode("Graph_403: body")).toBe("send_failed");
  });
});
