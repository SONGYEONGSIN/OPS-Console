import { describe, it, expect } from "vitest";
import { filterVisibleScheduleEvents } from "../_calendar-helpers";
import type { ScheduleEventRow } from "@/features/schedule/schemas";

function ev(partial: Partial<ScheduleEventRow>): ScheduleEventRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    type: "event",
    title: "t",
    description: null,
    start_at: "2026-06-01T00:00:00Z",
    end_at: null,
    all_day: true,
    assignee_email: null,
    created_by_email: "creator@x.com",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...partial,
  };
}

const me = "me@x.com";

describe("filterVisibleScheduleEvents", () => {
  it("mineActive=false 면 전체 반환", () => {
    const events = [
      ev({ assignee_email: "o@x.com", created_by_email: "o@x.com" }),
    ];
    expect(
      filterVisibleScheduleEvents(events, { mineActive: false, myEmail: me }),
    ).toEqual(events);
  });

  it("myEmail 없으면 전체 반환", () => {
    const events = [ev({ assignee_email: "o@x.com" })];
    expect(
      filterVisibleScheduleEvents(events, { mineActive: true, myEmail: null }),
    ).toEqual(events);
  });

  it("mine 모드: 본인 담당/생성 일정 포함", () => {
    const mineAssignee = ev({
      id: "a",
      assignee_email: me,
      created_by_email: "o@x.com",
    });
    const mineCreator = ev({
      id: "b",
      assignee_email: "o@x.com",
      created_by_email: me,
    });
    expect(
      filterVisibleScheduleEvents([mineAssignee, mineCreator], {
        mineActive: true,
        myEmail: me,
      }),
    ).toEqual([mineAssignee, mineCreator]);
  });

  it("mine 모드: 팀 공통(담당자 없음)은 남이 만들어도 포함 ← 버그 수정", () => {
    const teamCommon = ev({
      id: "c",
      assignee_email: null,
      created_by_email: "o@x.com",
    });
    expect(
      filterVisibleScheduleEvents([teamCommon], {
        mineActive: true,
        myEmail: me,
      }),
    ).toEqual([teamCommon]);
  });

  it("mine 모드: 남의 개인 일정(담당자=타인)은 제외", () => {
    const others = ev({
      id: "d",
      assignee_email: "o@x.com",
      created_by_email: "o2@x.com",
    });
    expect(
      filterVisibleScheduleEvents([others], { mineActive: true, myEmail: me }),
    ).toEqual([]);
  });
});
