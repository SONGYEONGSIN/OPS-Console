import { describe, it, expect } from "vitest";
import { toKstEvent } from "../schedule-format";

/**
 * 일정 시각을 KST로 바꿔서 모델에 넘긴다.
 *
 * 도구가 `2027-09-11T14:59:00+00:00`을 그대로 넘기니, 답변이 **"14:59+00:00로
 * 저장돼 있어 표기 기준(KST면 23:59)에 따라 달라질 수 있습니다"** 처럼 나왔다
 * (2026-08-19 실측). DB는 정상이다 — timestamptz 로 제대로 들어 있다.
 * 모델에게 UTC 원본을 주면서 "알아서 해석하라"고 한 게 문제였다.
 *
 * 원본을 함께 넘기지 않는다. 둘 다 보이면 모델이 다시 헷갈린다.
 */
describe("toKstEvent", () => {
  const row = {
    type: "이벤트",
    title: "수시 당직 - 운영1팀",
    description: null,
    start_at: "2026-09-10T09:00:00+00:00",
    end_at: "2026-09-10T13:00:00+00:00",
    all_day: false,
    assignee_email: "a@b.com",
  };

  it("UTC를 KST 시각으로 바꾼다", () => {
    const e = toKstEvent(row);
    // 09:00Z = 18:00 KST
    expect(e.start_kst).toBe("2026-09-10 18:00");
    expect(e.end_kst).toBe("2026-09-10 22:00");
  });

  it("원본 UTC는 넘기지 않는다 — 둘 다 보이면 다시 헷갈린다", () => {
    const e = toKstEvent(row) as Record<string, unknown>;
    expect(e.start_at).toBeUndefined();
    expect(e.end_at).toBeUndefined();
    expect(JSON.stringify(e)).not.toContain("+00:00");
  });

  it("날짜가 바뀌는 경우도 맞다 — 자정 근처가 하루 밀리면 마감을 놓친다", () => {
    // 2026-09-11 14:59Z = 2026-09-11 23:59 KST
    const e = toKstEvent({ ...row, start_at: "2026-09-11T14:59:00+00:00", end_at: null });
    expect(e.start_kst).toBe("2026-09-11 23:59");
    // 15:00Z 는 다음날 00:00 KST
    const f = toKstEvent({ ...row, start_at: "2026-09-11T15:00:00+00:00", end_at: null });
    expect(f.start_kst).toBe("2026-09-12 00:00");
  });

  it("종료가 없으면 종료 칸을 아예 안 만든다", () => {
    const e = toKstEvent({ ...row, end_at: null }) as Record<string, unknown>;
    expect("end_kst" in e).toBe(false);
  });

  it("종일 일정은 시각을 붙이지 않는다 — 없는 정밀도를 지어내지 않는다", () => {
    const e = toKstEvent({ ...row, all_day: true });
    expect(e.start_kst).toBe("2026-09-10");
  });

  it("제목·유형·담당자는 그대로 남긴다", () => {
    const e = toKstEvent(row);
    expect(e.title).toBe("수시 당직 - 운영1팀");
    expect(e.type).toBe("이벤트");
    expect(e.assignee_email).toBe("a@b.com");
  });
});
