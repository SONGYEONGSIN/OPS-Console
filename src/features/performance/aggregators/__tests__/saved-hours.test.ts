import { describe, it, expect } from "vitest";
import { aggregateSavedHours } from "../saved-hours";
import { aggregateEntertest } from "../entertest";

const P = { startYmd: "2026-03-01", endYmd: "2027-02-28" };

/**
 * '내 작업' 은 건수만 세고 있었다. 그런데 `ai_work.saved_hours` 에 **절감시간**이
 * 이미 쌓여 있다 — 성과로 말할 때 "몇 건"보다 "몇 시간을 아꼈나"가 낫다.
 */
describe("aggregateSavedHours", () => {
  const rows = [
    { author_email: "me@x.com", saved_hours: 4, created_at: "2026-07-14T08:00:00Z" },
    { author_email: "me@x.com", saved_hours: 1.5, created_at: "2026-09-01T08:00:00Z" },
    { author_email: "남@x.com", saved_hours: 99, created_at: "2026-07-14T08:00:00Z" },
    { author_email: "me@x.com", saved_hours: 7, created_at: "2026-01-05T08:00:00Z" },
  ];

  it("본인 것만 기간 안에서 더한다", () => {
    // 4 + 1.5. 남의 것(99)과 기간 밖(7)은 뺀다.
    expect(aggregateSavedHours(rows, "me@x.com", P).value).toBe(5.5);
  });

  it("단위는 시간이다", () => {
    expect(aggregateSavedHours(rows, "me@x.com", P).unit).toBe("시간");
  });

  /**
   * `saved_hours` 는 필수 입력이 아니다. null 을 0 으로 세면 합계는 같지만
   * "몇 건이 근거인가"가 틀어진다 — 근거 건수는 값이 있는 것만 센다.
   */
  it("절감시간을 안 적은 건은 근거에서 뺀다", () => {
    const out = aggregateSavedHours(
      [
        { author_email: "me@x.com", saved_hours: 3, created_at: "2026-07-14T08:00:00Z" },
        { author_email: "me@x.com", saved_hours: null, created_at: "2026-07-15T08:00:00Z" },
      ],
      "me@x.com",
      P,
    );
    expect(out.value).toBe(3);
    expect(out.detail).toContain("1건");
  });

  it("아무것도 없으면 0", () => {
    expect(aggregateSavedHours([], "me@x.com", P).value).toBe(0);
  });

  it("소수 합의 부동소수 오차를 남기지 않는다", () => {
    const out = aggregateSavedHours(
      [
        { author_email: "me@x.com", saved_hours: 0.1, created_at: "2026-07-14T08:00:00Z" },
        { author_email: "me@x.com", saved_hours: 0.2, created_at: "2026-07-15T08:00:00Z" },
      ],
      "me@x.com",
      P,
    );
    expect(out.value).toBe(0.3);
  });
});

/**
 * 원서 테스트 실행 — `requested_by` 가 이메일이라 개인 귀속이 바로 된다.
 * 조사에서 "지금 데이터로 즉시 구현 가능"으로 확인된 갈래다.
 */
describe("aggregateEntertest", () => {
  const rows = [
    { requested_by: "me@x.com", status: "done", requested_at: "2026-07-14T08:00:00Z" },
    { requested_by: "me@x.com", status: "error", requested_at: "2026-07-15T08:00:00Z" },
    { requested_by: "남@x.com", status: "done", requested_at: "2026-07-14T08:00:00Z" },
    { requested_by: "me@x.com", status: "done", requested_at: "2026-01-05T08:00:00Z" },
  ];

  it("본인이 기간 안에 돌린 것만 센다", () => {
    expect(aggregateEntertest(rows, "me@x.com", P).value).toBe(2);
  });

  /**
   * 실패한 실행도 '돌린 것'이다 — 테스트는 깨진 걸 찾는 일이라 실패를 빼면
   * 일을 많이 한 사람이 적게 한 것으로 보인다. 대신 근거에 갈라 적는다.
   */
  it("실패도 세되 근거에 갈라 적는다", () => {
    const out = aggregateEntertest(rows, "me@x.com", P);
    expect(out.value).toBe(2);
    expect(out.detail).toContain("완료 1");
  });

  it("단위는 건이다", () => {
    expect(aggregateEntertest(rows, "me@x.com", P).unit).toBe("건");
  });
});
