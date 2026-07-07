import { describe, it, expect } from "vitest";
import { selectLatestPaymentSheet } from "../sheet-select";

describe("selectLatestPaymentSheet", () => {
  it("여러 기수 중 최대 기수 시트를 고른다 (실측 시트명)", () => {
    const names = [
      "19기비용지급일",
      "21기비용지급일(20.04~21.03)",
      "23기비용지급일(22.04~23.03)",
      "26기비용지급일(25.04~26.03)",
      "24기비용지급일(23.04~24.03)",
      "25기비용지급일(24.04~25.03)",
      "27기비용지급일(26.04~27.03)",
    ];
    expect(selectLatestPaymentSheet(names)).toBe("27기비용지급일(26.04~27.03)");
  });

  it("접미사(날짜범위) 없는 시트명도 파싱한다", () => {
    expect(selectLatestPaymentSheet(["19기비용지급일", "5기비용지급일"])).toBe(
      "19기비용지급일",
    );
  });

  it("숫자 비교(문자열 아님) — 9기 < 27기", () => {
    expect(
      selectLatestPaymentSheet([
        "9기비용지급일",
        "27기비용지급일(26.04~27.03)",
      ]),
    ).toBe("27기비용지급일(26.04~27.03)");
  });

  it("매칭 시트가 없으면 null", () => {
    expect(selectLatestPaymentSheet(["Sheet1", "요약", "기타"])).toBeNull();
  });

  it("빈 배열이면 null", () => {
    expect(selectLatestPaymentSheet([])).toBeNull();
  });
});
