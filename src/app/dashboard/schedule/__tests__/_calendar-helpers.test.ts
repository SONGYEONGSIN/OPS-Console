import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  groupItemsByDay,
  toKstYmd,
  type CalendarItem,
} from "../_calendar-helpers";
import type { ScheduleEventRow } from "@/features/schedule/schemas";
import type { ServicesRow } from "@/features/services/schemas";

describe("toKstYmd", () => {
  it("UTC ISO를 KST 기준 YYYY-MM-DD로 변환한다", () => {
    // 2026-05-31T16:00:00Z = KST 2026-06-01T01:00 — UTC와 KST가 다른 날짜
    expect(toKstYmd("2026-05-31T16:00:00Z")).toBe("2026-06-01");
    // 자정 직전 — 같은 날짜 유지
    expect(toKstYmd("2026-05-31T14:00:00Z")).toBe("2026-05-31");
    // 한국 시간으로 본 자연일
    expect(toKstYmd("2026-05-15T03:30:00Z")).toBe("2026-05-15");
  });

  it("KST가 이미 적용된 +09:00 ISO도 정상 처리한다", () => {
    expect(toKstYmd("2026-05-15T12:00:00+09:00")).toBe("2026-05-15");
  });
});

describe("buildMonthGrid", () => {
  it("2026년 5월(1일=금) 그리드는 42셀, 첫 셀은 일요일(4/26)", () => {
    const grid = buildMonthGrid(2026, 4); // month0 = 4 (May)
    expect(grid).toHaveLength(42);
    expect(grid[0]?.ymd).toBe("2026-04-26"); // 일요일
    expect(grid[0]?.inMonth).toBe(false);
    expect(grid[5]?.ymd).toBe("2026-05-01"); // 5/1 금
    expect(grid[5]?.inMonth).toBe(true);
    expect(grid[41]?.ymd).toBe("2026-06-06"); // 마지막 셀
    expect(grid[41]?.inMonth).toBe(false);
  });

  it("2026년 11월(1일=일) 그리드는 첫 셀이 11/1, inMonth=true", () => {
    const grid = buildMonthGrid(2026, 10); // November
    expect(grid).toHaveLength(42);
    expect(grid[0]?.ymd).toBe("2026-11-01");
    expect(grid[0]?.inMonth).toBe(true);
  });

  it("inMonth 플래그가 month0 일치 여부로 정확히 분기된다", () => {
    const grid = buildMonthGrid(2026, 4); // May
    const inMonthCount = grid.filter((c) => c.inMonth).length;
    expect(inMonthCount).toBe(31); // May has 31 days
  });
});

describe("groupItemsByDay", () => {
  const baseEvent: Omit<ScheduleEventRow, "id" | "type" | "title" | "start_at" | "all_day"> = {
    created_by_email: "x@x.com",
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
  };

  const baseService: Omit<
    ServicesRow,
    "id" | "service_id" | "service_name" | "write_start_at" | "write_end_at"
  > = {
    application_type: "공통원서",
    region: "서울",
    university_name: "○○대학교",
    university_type: "4년제",
    category: "수시",
    operator_email: null,
    operator_name: null,
    developer_email: null,
    developer_name: null,
    pay_start_at: null,
    pay_end_at: null,
    solo: false,
    source: "google_sheet_import",
    imported_at: null,
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
  };

  it("schedule_events를 ymd 키로 그룹화하고 shift 카테고리를 보존한다", () => {
    const events: ScheduleEventRow[] = [
      {
        ...baseEvent,
        id: "00000000-0000-0000-0000-000000000001",
        type: "shift",
        title: "오전 시프트",
        start_at: "2026-05-15T01:00:00Z", // KST 10:00
        all_day: false,
      },
    ];
    const map = groupItemsByDay(events, []);
    const items = map.get("2026-05-15");
    expect(items).toBeDefined();
    expect(items?.[0]?.category).toBe("shift");
    expect(items?.[0]?.label).toBe("오전 시프트");
    expect(items?.[0]?.sourceVariant).toBe("schedule");
  });

  it("services row 1개를 write_start_at/end_at 2 item으로 분해한다 (각각 카테고리)", () => {
    const services: ServicesRow[] = [
      {
        ...baseService,
        id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        service_id: 1001,
        service_name: "원서접수 PIMS",
        write_start_at: "2026-05-10",
        write_end_at: "2026-05-20",
      },
    ];
    const map = groupItemsByDay([], services);
    const startItems = map.get("2026-05-10");
    const endItems = map.get("2026-05-20");
    expect(startItems?.[0]?.category).toBe("service-start");
    expect(startItems?.[0]?.sourceVariant).toBe("services");
    expect(endItems?.[0]?.category).toBe("service-end");
    expect(endItems?.[0]?.sourceVariant).toBe("services");
  });

  it("services 날짜가 null이면 skip한다", () => {
    const services: ServicesRow[] = [
      {
        ...baseService,
        id: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
        service_id: 1002,
        service_name: "X",
        write_start_at: null,
        write_end_at: "2026-05-20",
      },
    ];
    const map = groupItemsByDay([], services);
    expect(map.get("2026-05-20")).toHaveLength(1); // end만
    // null start는 어떤 키에도 등록되지 않음
    const allItems: CalendarItem[] = [];
    for (const list of map.values()) allItems.push(...list);
    expect(allItems).toHaveLength(1);
  });

  it("schedule event end_at이 시작과 다른 날이면 시작/종료 두 ymd에 push (멀티데이)", () => {
    const events: ScheduleEventRow[] = [
      {
        ...baseEvent,
        id: "44444444-4444-4444-4444-444444444444",
        type: "application",
        title: "수시 재외국민",
        start_at: "2026-09-06T15:00:00Z", // KST 9/7 00:00
        end_at: "2026-09-11T14:59:00Z", // KST 9/11 23:59
        all_day: false,
      },
    ];
    const map = groupItemsByDay(events, []);
    expect(map.get("2026-09-07")?.[0]?.label).toBe("수시 재외국민");
    expect(map.get("2026-09-11")?.[0]?.label).toBe("수시 재외국민");
    // 두 item의 rowRef는 같은 event (인스펙터가 동일하게 열리도록)
    expect(map.get("2026-09-07")?.[0]?.rowRef).toBe(
      map.get("2026-09-11")?.[0]?.rowRef,
    );
  });

  it("schedule event end_at이 시작과 같은 날이면 종료 push 안 함 (중복 방지)", () => {
    const events: ScheduleEventRow[] = [
      {
        ...baseEvent,
        id: "55555555-5555-5555-5555-555555555555",
        type: "event",
        title: "1시간 회의",
        start_at: "2026-05-15T01:00:00Z", // KST 10:00
        end_at: "2026-05-15T02:00:00Z", // KST 11:00
        all_day: false,
      },
    ];
    const map = groupItemsByDay(events, []);
    expect(map.get("2026-05-15")).toHaveLength(1);
  });

  it("같은 날짜에 다중 아이템이면 [all_day desc, sortKey asc] 순으로 정렬한다", () => {
    const events: ScheduleEventRow[] = [
      {
        ...baseEvent,
        id: "11111111-1111-1111-1111-111111111111",
        type: "shift",
        title: "10시 시프트",
        start_at: "2026-05-15T01:00:00Z", // KST 10:00
        all_day: false,
      },
      {
        ...baseEvent,
        id: "22222222-2222-2222-2222-222222222222",
        type: "leave",
        title: "종일 휴가",
        start_at: "2026-05-15T00:00:00Z",
        all_day: true,
      },
      {
        ...baseEvent,
        id: "33333333-3333-3333-3333-333333333333",
        type: "event",
        title: "14시 회의",
        start_at: "2026-05-15T05:00:00Z", // KST 14:00
        all_day: false,
      },
    ];
    const items = groupItemsByDay(events, [])
      .get("2026-05-15")
      ?.map((i) => i.label);
    expect(items).toEqual(["종일 휴가", "10시 시프트", "14시 회의"]);
  });
});
