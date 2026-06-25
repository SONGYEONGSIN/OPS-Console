import { describe, it, expect } from "vitest";
import { QUOTE_SENDER } from "../sender";

describe("QUOTE_SENDER", () => {
  it("등록번호·주소 상수 채움 (Image #12)", () => {
    expect(QUOTE_SENDER.bizNo).toBe("101-86-62676");
    expect(QUOTE_SENDER.address).toBe("서울 종로구 경희궁길 34 진학기획빌딩");
    expect(QUOTE_SENDER.company).toBe("주식회사 진학어플라이");
    expect(QUOTE_SENDER.ceo).toBe("신원근");
  });
});
