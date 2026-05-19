import { describe, it, expect } from "vitest";
import {
  getKstWeekStart,
  getKstWeekDays,
  toKstYmd,
  bucketTodosByDay,
  bucketServicesByDay,
} from "../week-grid";
import type { TodoRow } from "@/features/todos/schemas";
import type { ServicesRow } from "@/features/services/schemas";

describe("toKstYmd", () => {
  it("UTC ISO → KST YYYY-MM-DD", () => {
    expect(toKstYmd("2026-05-18T15:00:00Z")).toBe("2026-05-19");
    expect(toKstYmd("2026-05-19T00:00:00+09:00")).toBe("2026-05-19");
  });
});

describe("getKstWeekStart (월요일 시작)", () => {
  it("2026-05-19 (화) → 2026-05-18 (월)", () => {
    expect(getKstWeekStart("2026-05-19")).toBe("2026-05-18");
  });

  it("2026-05-18 (월) → 동일", () => {
    expect(getKstWeekStart("2026-05-18")).toBe("2026-05-18");
  });

  it("2026-05-24 (일) → 2026-05-18 (월)", () => {
    expect(getKstWeekStart("2026-05-24")).toBe("2026-05-18");
  });
});

describe("getKstWeekDays", () => {
  it("주 시작 입력 → 14일 ymd 배열 (월~일 × 2주)", () => {
    const days = getKstWeekDays("2026-05-18");
    expect(days).toEqual([
      "2026-05-18",
      "2026-05-19",
      "2026-05-20",
      "2026-05-21",
      "2026-05-22",
      "2026-05-23",
      "2026-05-24",
      "2026-05-25",
      "2026-05-26",
      "2026-05-27",
      "2026-05-28",
      "2026-05-29",
      "2026-05-30",
      "2026-05-31",
    ]);
  });
});

describe("bucketTodosByDay", () => {
  const baseTodo: Omit<TodoRow, "id" | "title" | "due_at"> = {
    body: null,
    done: false,
    done_at: null,
    priority: "medium",
    assignee_email: "me@x.com",
    created_by_email: "me@x.com",
    created_at: "2026-05-18T00:00:00Z",
    updated_at: "2026-05-18T00:00:00Z",
  };

  it("due_at의 KST 날짜로 셀 분배", () => {
    const todos: TodoRow[] = [
      {
        ...baseTodo,
        id: "00000000-0000-0000-0000-000000000001",
        title: "Mon todo",
        due_at: "2026-05-18T05:00:00Z", // KST 14:00 = 2026-05-18
      },
      {
        ...baseTodo,
        id: "00000000-0000-0000-0000-000000000002",
        title: "Tue todo",
        due_at: "2026-05-19T05:00:00Z", // KST 14:00 = 2026-05-19
      },
    ];
    const days = getKstWeekDays("2026-05-18");
    const buckets = bucketTodosByDay(todos, days);
    expect(buckets["2026-05-18"]).toHaveLength(1);
    expect(buckets["2026-05-18"]?.[0]?.title).toBe("Mon todo");
    expect(buckets["2026-05-19"]).toHaveLength(1);
    expect(buckets["2026-05-20"]).toEqual([]);
  });

  it("due_at null인 todo는 어느 셀에도 들어가지 않음", () => {
    const todos: TodoRow[] = [
      {
        ...baseTodo,
        id: "00000000-0000-0000-0000-000000000003",
        title: "no due",
        due_at: null,
      },
    ];
    const days = getKstWeekDays("2026-05-18");
    const buckets = bucketTodosByDay(todos, days);
    for (const d of days) expect(buckets[d]).toEqual([]);
  });
});

describe("bucketServicesByDay", () => {
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

  it("services write_start_at / write_end_at을 ymd 별로 분배 (kind start/end)", () => {
    const services: ServicesRow[] = [
      {
        ...baseService,
        id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        service_id: 1001,
        service_name: "PIMS 원서",
        write_start_at: "2026-05-22",
        write_end_at: "2026-05-25",
      },
    ];
    const days = getKstWeekDays("2026-05-18");
    const buckets = bucketServicesByDay(services, days);
    expect(buckets["2026-05-22"]?.[0]?.kind).toBe("start");
    expect(buckets["2026-05-22"]?.[0]?.service.service_name).toBe("PIMS 원서");
    expect(buckets["2026-05-25"]?.[0]?.kind).toBe("end");
  });

  it("write_start_at null이면 start 미생성, write_end_at null이면 end 미생성", () => {
    const services: ServicesRow[] = [
      {
        ...baseService,
        id: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
        service_id: 1002,
        service_name: "X",
        write_start_at: null,
        write_end_at: "2026-05-23",
      },
    ];
    const days = getKstWeekDays("2026-05-18");
    const buckets = bucketServicesByDay(services, days);
    const all = days.flatMap((d) => buckets[d] ?? []);
    expect(all).toHaveLength(1);
    expect(all[0]?.kind).toBe("end");
  });

  it("days 범위 밖 날짜는 무시", () => {
    const services: ServicesRow[] = [
      {
        ...baseService,
        id: "f47ac10b-58cc-4372-a567-0e02b2c3d481",
        service_id: 1003,
        service_name: "Far",
        write_start_at: "2026-06-15",
        write_end_at: "2026-06-20",
      },
    ];
    const days = getKstWeekDays("2026-05-18");
    const buckets = bucketServicesByDay(services, days);
    const all = days.flatMap((d) => buckets[d] ?? []);
    expect(all).toHaveLength(0);
  });
});
