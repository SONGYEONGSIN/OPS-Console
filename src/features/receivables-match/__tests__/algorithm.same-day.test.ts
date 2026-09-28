import { describe, it, expect } from "vitest";
import { runMatch } from "../algorithm";
import type { MisuRow, DepositRow } from "../types";

/**
 * 계산서 발행일(청구일)과 같은 날 들어온 입금.
 *
 * 2026-09-28 부산과학고등학교 1,280,000 이 매칭되지 않았다. 청구·입금이 모두
 * 2026-09-17 이었고, 규칙이 GAS `isDateMatch_` 그대로 '입금일 ≥ 청구일 + 1일' 이라
 * 금액·이름이 다 맞는데도 빠졌다. 불일치 확인 요청에도 같은 조건이 걸려 있어
 * 매칭·불일치 어디에도 안 뜨는 조용한 누락이었다.
 *
 * 경계는 하루 옮긴 것이지 없앤 것이 아니다 — 청구일보다 **먼저** 들어온 입금은
 * 예전 청구의 대금이라 계속 제외한다(당시 실데이터에 금액·이름이 같은 그런 쌍이 3개).
 */

const misu = (date: string): MisuRow => ({
  rowNumber: 22,
  date,
  customer: "부산과학고등학교",
  amount: 1280000,
  note: "",
});

const dep = (date: string): DepositRow => ({
  row: 2317,
  date,
  content: "부산과학고등",
  amount: 1280000,
  matchedFlag: "0",
});

describe("runMatch — 청구일과 같은 날 들어온 입금", () => {
  it("같은 날 입금도 1:1 로 매칭한다", () => {
    const result = runMatch([misu("2026-09-17")], [dep("2026-09-17 15:28:55")]);

    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]).toMatchObject({
      misuRows: [22],
      depRows: [2317],
      kind: "oneToOne",
    });
  });

  it("청구일이 점 표기여도 같은 날로 본다 — 문자열 그대로 견주면 '-' < '.' 라 빠진다", () => {
    const result = runMatch([misu("2026.9.17")], [dep("2026-09-17 15:28:55")]);

    expect(result.matched).toHaveLength(1);
  });

  // 점 표기도 본다 — 청구일을 UTC 로 바꿔 자르는 식으로 고치면 KST 에서 점 표기만
  // 하루 당겨져(2026.9.17 → 2026-09-16) 전날 입금이 붙는데, 하이픈만 보면 초록이다.
  it.each(["2026-09-17", "2026.9.17"])(
    "청구일보다 먼저 들어온 입금은 여전히 매칭하지 않는다 (청구일 %s)",
    (billDate) => {
      const result = runMatch([misu(billDate)], [dep("2026-09-16 15:28:55")]);

      expect(result.matched).toHaveLength(0);
    },
  );
});

/**
 * 불일치 확인 요청(금액 같음·이름 다름)도 같은 날짜 규칙을 쓴다. 이 경로가 +1일로
 * 남으면 같은 날 들어온 표기 변형 입금이 다시 아무 데도 안 뜬다 — 이번 누락의 모양
 * 그대로다. 서강대학교 ↔ 서강국제대학원 은 확인 요청이 가야 하는 별칭 후보다
 * (`algorithm.mismatch-similarity.test.ts`).
 */
describe("runMatch — 같은 날 입금의 불일치 확인 요청", () => {
  const seogang = (depDate: string) =>
    runMatch(
      [
        {
          rowNumber: 5,
          date: "2026-09-17",
          customer: "서강대학교",
          amount: 40000,
          note: "",
        },
      ],
      [
        {
          row: 9,
          date: depDate,
          content: "서강국제대학원",
          amount: 40000,
          matchedFlag: "",
        },
      ],
    );

  it("같은 날 입금도 확인 요청에 오른다", () => {
    expect(seogang("2026-09-17 10:00:00").mismatches).toHaveLength(1);
  });

  it("청구일보다 먼저 들어온 입금은 확인 요청하지 않는다", () => {
    expect(seogang("2026-09-16 10:00:00").mismatches).toHaveLength(0);
  });
});
