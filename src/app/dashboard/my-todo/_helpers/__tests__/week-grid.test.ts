import { describe, it, expect } from "vitest";
import {
  getKstWeekStart,
  getKstWeekDays,
  toKstYmd,
  bucketTodosByDay,
} from "../week-grid";
import type { TodoRow } from "@/features/todos/schemas";

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
  it("주 시작 입력 → 7일 ymd 배열 (월~일)", () => {
    const days = getKstWeekDays("2026-05-18");
    expect(days).toEqual([
      "2026-05-18",
      "2026-05-19",
      "2026-05-20",
      "2026-05-21",
      "2026-05-22",
      "2026-05-23",
      "2026-05-24",
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
