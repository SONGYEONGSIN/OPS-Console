import { describe, it, expect } from "vitest";
import { sortForOpenNotice, isOpenNoticeTarget } from "../queries";

type Row = { service_id: number; write_start_at: string | null };

describe("sortForOpenNotice", () => {
  it("작성시작 오름차순 — 가장 먼저 여는 건이 1페이지", () => {
    // listTestableServices() 는 write_end_at 내림차순으로 준다. 그대로 쓰면
    // 가장 늦게(≈1년 뒤) 여는 건이 맨 앞에 오고 다음 주 오픈 건이 뒷장에 묻힌다.
    const rows: Row[] = [
      { service_id: 3, write_start_at: "2027-03-01T00:00:00Z" },
      { service_id: 1, write_start_at: "2026-09-07T00:00:00Z" },
      { service_id: 2, write_start_at: "2026-12-01T00:00:00Z" },
    ];
    expect(sortForOpenNotice(rows).map((r) => r.service_id)).toEqual([1, 2, 3]);
  });

  it("작성시작이 없는 건은 뒤로", () => {
    const rows: Row[] = [
      { service_id: 1, write_start_at: null },
      { service_id: 2, write_start_at: "2026-09-07T00:00:00Z" },
      { service_id: 3, write_start_at: null },
    ];
    expect(sortForOpenNotice(rows).map((r) => r.service_id)).toEqual([2, 1, 3]);
  });

  it("원본 배열을 건드리지 않는다", () => {
    const rows: Row[] = [
      { service_id: 2, write_start_at: "2027-01-01T00:00:00Z" },
      { service_id: 1, write_start_at: "2026-09-07T00:00:00Z" },
    ];
    const before = rows.map((r) => r.service_id);
    sortForOpenNotice(rows);
    expect(rows.map((r) => r.service_id)).toEqual(before);
  });

  it("같은 시각이면 원래 순서를 유지한다", () => {
    const rows: Row[] = [
      { service_id: 5, write_start_at: "2026-09-07T00:00:00Z" },
      { service_id: 4, write_start_at: "2026-09-07T00:00:00Z" },
    ];
    expect(sortForOpenNotice(rows).map((r) => r.service_id)).toEqual([5, 4]);
  });

  it("빈 배열도 안전", () => {
    expect(sortForOpenNotice([])).toEqual([]);
  });
});

describe("isOpenNoticeTarget — 목록에 담을 단계", () => {
  const now = new Date("2026-09-10T00:00:00Z");

  it("오픈 예정(upcoming)은 담는다", () => {
    expect(
      isOpenNoticeTarget(
        { write_start_at: "2026-09-20T00:00:00Z", pay_end_at: "2026-10-01T00:00:00Z" },
        now,
      ),
    ).toBe(true);
  });

  it("접수 중(running)도 담는다 — 토글을 못 켠 건이 사라지면 영영 못 보낸다", () => {
    expect(
      isOpenNoticeTarget(
        { write_start_at: "2026-09-01T00:00:00Z", pay_end_at: "2026-10-01T00:00:00Z" },
        now,
      ),
    ).toBe(true);
  });

  it("결제까지 끝난 건(closed)은 뺀다 — 이제 와서 안내할 이유가 없다", () => {
    expect(
      isOpenNoticeTarget(
        { write_start_at: "2026-08-01T00:00:00Z", pay_end_at: "2026-09-01T00:00:00Z" },
        now,
      ),
    ).toBe(false);
  });

  it("결제마감이 작성시작보다 앞선 이상 데이터도 closed 로 뺀다", () => {
    // 강릉영동대 케이스 — phaseOf 와 같은 우선순위(마감이 이긴다)
    expect(
      isOpenNoticeTarget(
        { write_start_at: "2026-09-20T00:00:00Z", pay_end_at: "2025-09-30T00:00:00Z" },
        now,
      ),
    ).toBe(false);
  });
});
