import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  groupItemsByDay,
  toKstYmd,
  type BackupLeaveInput,
  type CalendarItem,
} from "../_calendar-helpers";
import type { ScheduleEventRow } from "@/features/schedule/schemas";
import type { ServicesRow } from "@/features/services/schemas";
import type { BackupRequestRow } from "@/features/backup-requests/schemas";

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
  const baseEvent: Omit<
    ScheduleEventRow,
    "id" | "type" | "title" | "start_at" | "all_day"
  > = {
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

  it("멀티데이 일정은 시작~종료 사이 중간 날짜에도 모두 표기한다 (28일 누락 버그)", () => {
    const events: ScheduleEventRow[] = [
      {
        ...baseEvent,
        id: "99999999-9999-9999-9999-999999999999",
        type: "application",
        title: "원서접수 기간",
        start_at: "2026-07-26T15:00:00Z", // KST 7/27 00:00
        end_at: "2026-07-29T14:59:00Z", // KST 7/29 23:59
        all_day: true,
      },
    ];
    const map = groupItemsByDay(events, []);
    // 시작(27)·중간(28)·종료(29) 모두 표기되어야 한다
    for (const ymd of ["2026-07-27", "2026-07-28", "2026-07-29"]) {
      expect(map.get(ymd)?.[0]?.label).toBe("원서접수 기간");
    }
    // 중간 날짜도 같은 원본 rowRef (인스펙터 동일 표시)
    expect(map.get("2026-07-28")?.[0]?.rowRef).toBe(
      map.get("2026-07-27")?.[0]?.rowRef,
    );
    // 범위 밖(26/30)은 등록되지 않음
    expect(map.get("2026-07-26")).toBeUndefined();
    expect(map.get("2026-07-30")).toBeUndefined();
  });

  it("멀티데이 일정은 주말(토·일) 셀에는 표기하지 않는다", () => {
    const events: ScheduleEventRow[] = [
      {
        ...baseEvent,
        id: "88888888-8888-8888-8888-888888888888",
        type: "leave",
        title: "운영1팀-김유민-연차",
        start_at: "2026-07-21T15:00:00Z", // KST 7/22(수)
        end_at: "2026-07-26T15:00:00Z", // KST 7/27(월)
        all_day: true,
      },
    ];
    const map = groupItemsByDay(events, []);
    // 평일(22수·23목·24금·27월)은 표기
    for (const ymd of [
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
      "2026-07-27",
    ]) {
      expect(map.get(ymd)?.[0]?.label).toBe("운영1팀-김유민-연차");
    }
    // 주말(25토·26일)은 제외
    expect(map.get("2026-07-25")).toBeUndefined();
    expect(map.get("2026-07-26")).toBeUndefined();
  });

  it("입시·행사 멀티데이(application/pims/event)는 주말에도 표기한다", () => {
    const mk = (
      type: ScheduleEventRow["type"],
      id: string,
    ): ScheduleEventRow => ({
      ...baseEvent,
      id,
      type,
      title: `${type} 기간`,
      start_at: "2026-07-23T15:00:00Z", // KST 7/24(금)
      end_at: "2026-07-26T15:00:00Z", // KST 7/27(월) — 25토·26일 포함
      all_day: true,
    });
    for (const type of ["application", "pims", "event"] as const) {
      const map = groupItemsByDay(
        [mk(type, `id-${type}-0000-0000-000000000000`)],
        [],
      );
      // 주말(25토·26일)에도 표기되어야 한다
      expect(map.get("2026-07-25")?.[0]?.label).toBe(`${type} 기간`);
      expect(map.get("2026-07-26")?.[0]?.label).toBe(`${type} 기간`);
    }
  });

  it("교육(training) 멀티데이는 주말 셀 제외", () => {
    const events: ScheduleEventRow[] = [
      {
        ...baseEvent,
        id: "66666666-6666-6666-6666-666666666666",
        type: "training",
        title: "온보딩 교육",
        start_at: "2026-07-23T15:00:00Z", // KST 7/24(금)
        end_at: "2026-07-27T15:00:00Z", // KST 7/28(화)
        all_day: true,
      },
    ];
    const map = groupItemsByDay(events, []);
    expect(map.get("2026-07-24")?.[0]?.label).toBe("온보딩 교육");
    expect(map.get("2026-07-27")?.[0]?.label).toBe("온보딩 교육");
    expect(map.get("2026-07-25")).toBeUndefined();
    expect(map.get("2026-07-26")).toBeUndefined();
  });

  it("단일일(멀티데이 아님) 일정은 주말이어도 표기한다", () => {
    const events: ScheduleEventRow[] = [
      {
        ...baseEvent,
        id: "77777777-7777-7777-7777-777777777777",
        type: "event",
        title: "주말 행사",
        start_at: "2026-07-25T01:00:00Z", // KST 7/25(토)
        end_at: null,
        all_day: false,
      },
    ];
    const map = groupItemsByDay(events, []);
    expect(map.get("2026-07-25")?.[0]?.label).toBe("주말 행사");
  });

  it("팀 공통(assignee_email=null) 일정은 isTeamCommon=true + 셀 최상단으로 정렬", () => {
    const events: ScheduleEventRow[] = [
      {
        ...baseEvent,
        id: "66666666-6666-6666-6666-666666666666",
        type: "shift",
        title: "10시 본인 시프트",
        start_at: "2026-05-15T01:00:00Z",
        assignee_email: "kjn@example.com",
        all_day: false,
      },
      {
        ...baseEvent,
        id: "77777777-7777-7777-7777-777777777777",
        type: "application",
        title: "원서접수 일정",
        start_at: "2026-05-15T05:00:00Z", // KST 14:00 — 시각상 뒤
        assignee_email: null, // 팀 공통
        all_day: false,
      },
    ];
    const items = groupItemsByDay(events, [])
      .get("2026-05-15")
      ?.map((i) => ({ label: i.label, isTeamCommon: !!i.isTeamCommon }));
    // 팀 공통이 시각상 더 뒤(14:00)지만 정렬 1순위로 최상단
    expect(items).toEqual([
      { label: "원서접수 일정", isTeamCommon: true },
      { label: "10시 본인 시프트", isTeamCommon: false },
    ]);
  });

  it("같은 날 같은 사람이 백업요청 등록돼 있으면 schedule leave 중복 제거 — 백업요청만", () => {
    const events: ScheduleEventRow[] = [
      {
        ...baseEvent,
        id: "88888888-8888-8888-8888-888888888888",
        type: "leave",
        title: "운영2팀-윤지혜-연차",
        start_at: "2026-07-23T15:00:00Z", // KST 7/24(금)
        all_day: true,
        assignee_email: null,
      },
    ];
    const backupLeaves: BackupLeaveInput[] = [
      {
        id: "bl-1",
        team: "운영2팀",
        name: "윤지혜",
        leaveType: "연차",
        startYmd: "2026-07-24",
        endYmd: null,
        rowRef: {} as unknown as BackupLeaveInput["rowRef"],
      },
    ];
    const items = groupItemsByDay(events, [], backupLeaves).get("2026-07-24") ?? [];
    expect(items).toHaveLength(1);
    expect(items[0].category).toBe("backup-leave");
    expect(items[0].sourceVariant).toBe("backup");
  });

  it("백업요청 없는 사람의 schedule leave는 그대로 유지", () => {
    const events: ScheduleEventRow[] = [
      {
        ...baseEvent,
        id: "99999999-9999-9999-9999-999999999999",
        type: "leave",
        title: "운영1팀-김유민-연차",
        start_at: "2026-07-23T15:00:00Z", // KST 7/24
        all_day: true,
        assignee_email: null,
      },
    ];
    const backupLeaves: BackupLeaveInput[] = [
      {
        id: "bl-2",
        team: "운영2팀",
        name: "윤지혜",
        leaveType: "연차",
        startYmd: "2026-07-24",
        endYmd: null,
        rowRef: {} as unknown as BackupLeaveInput["rowRef"],
      },
    ];
    const items = groupItemsByDay(events, [], backupLeaves).get("2026-07-24") ?? [];
    // 김유민 leave(유지) + 윤지혜 backup-leave = 2
    expect(items).toHaveLength(2);
    expect(items.some((i) => i.label === "운영1팀-김유민-연차")).toBe(true);
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

  // 백업 요청 휴가유형 — 운영부 달력 표기 (팀-이름-휴가유형)
  const baseLeave: Omit<
    BackupLeaveInput,
    "id" | "team" | "name" | "leaveType" | "startYmd" | "endYmd"
  > = {
    rowRef: { id: "leave-row" } as unknown as BackupRequestRow,
  };

  it("백업 휴가를 시작~종료 모든 날짜에 펼치고 '팀-이름-휴가유형' 라벨로 표기한다", () => {
    const leaves: BackupLeaveInput[] = [
      {
        ...baseLeave,
        id: "aaaaaaaa-0000-0000-0000-000000000001",
        team: "운영2팀",
        name: "홍길동",
        leaveType: "연차",
        startYmd: "2026-05-20",
        endYmd: "2026-05-22",
      },
    ];
    const map = groupItemsByDay([], [], leaves);
    for (const ymd of ["2026-05-20", "2026-05-21", "2026-05-22"]) {
      const item = map.get(ymd)?.[0];
      expect(item?.category).toBe("backup-leave");
      expect(item?.sourceVariant).toBe("backup");
      expect(item?.label).toBe("운영2팀-홍길동-연차");
    }
    // 범위 밖은 등록되지 않음
    expect(map.get("2026-05-23")).toBeUndefined();
    // 모든 item의 rowRef는 동일 원본 (인스펙터 동일 표시)
    expect(map.get("2026-05-20")?.[0]?.rowRef).toBe(
      map.get("2026-05-22")?.[0]?.rowRef,
    );
  });

  it("휴가 기간 중 주말(토·일)은 표기에서 제외한다", () => {
    const leaves: BackupLeaveInput[] = [
      {
        ...baseLeave,
        id: "aaaaaaaa-0000-0000-0000-000000000009",
        team: "운영2팀",
        name: "박시현",
        leaveType: "연차",
        startYmd: "2026-05-22", // 금
        endYmd: "2026-05-25", // 월
      },
    ];
    const map = groupItemsByDay([], [], leaves);
    expect(map.get("2026-05-22")?.[0]?.category).toBe("backup-leave"); // 금 표기
    expect(map.get("2026-05-25")?.[0]?.category).toBe("backup-leave"); // 월 표기
    expect(map.get("2026-05-23")).toBeUndefined(); // 토 제외
    expect(map.get("2026-05-24")).toBeUndefined(); // 일 제외
  });

  it("백업 휴가는 팀공통 일정보다도 셀 최상단에 정렬된다", () => {
    const events: ScheduleEventRow[] = [
      {
        ...baseEvent,
        id: "88888888-8888-8888-8888-888888888888",
        type: "application",
        title: "팀 공통 일정",
        start_at: "2026-05-20T00:00:00Z",
        assignee_email: null,
        all_day: true,
      },
    ];
    const leaves: BackupLeaveInput[] = [
      {
        ...baseLeave,
        id: "aaaaaaaa-0000-0000-0000-000000000002",
        team: "운영1팀",
        name: "김운영",
        leaveType: "출장",
        startYmd: "2026-05-20",
        endYmd: "2026-05-20",
      },
    ];
    const labels = groupItemsByDay(events, [], leaves)
      .get("2026-05-20")
      ?.map((i) => i.label);
    expect(labels).toEqual(["운영1팀-김운영-출장", "팀 공통 일정"]);
  });

  it("종료일이 없으면 시작일 하루만 표기한다", () => {
    const leaves: BackupLeaveInput[] = [
      {
        ...baseLeave,
        id: "aaaaaaaa-0000-0000-0000-000000000003",
        team: "운영1팀",
        name: "이외근",
        leaveType: "외근",
        startYmd: "2026-05-20",
        endYmd: null,
      },
    ];
    const map = groupItemsByDay([], [], leaves);
    expect(map.get("2026-05-20")?.[0]?.label).toBe("운영1팀-이외근-외근");
    expect(map.get("2026-05-21")).toBeUndefined();
  });

  it("팀이 없으면 '이름-휴가유형'으로 표기한다", () => {
    const leaves: BackupLeaveInput[] = [
      {
        ...baseLeave,
        id: "aaaaaaaa-0000-0000-0000-000000000004",
        team: null,
        name: "박휴가",
        leaveType: "교육",
        startYmd: "2026-05-20",
        endYmd: "2026-05-20",
      },
    ];
    const map = groupItemsByDay([], [], leaves);
    expect(map.get("2026-05-20")?.[0]?.label).toBe("박휴가-교육");
  });

  it("시작일이 없으면 skip한다", () => {
    const leaves: BackupLeaveInput[] = [
      {
        ...baseLeave,
        id: "aaaaaaaa-0000-0000-0000-000000000005",
        team: "운영1팀",
        name: "최무효",
        leaveType: "연차",
        startYmd: "",
        endYmd: "2026-05-22",
      },
    ];
    const map = groupItemsByDay([], [], leaves);
    const all: CalendarItem[] = [];
    for (const list of map.values()) all.push(...list);
    expect(all).toHaveLength(0);
  });
});
