import { describe, it, expect } from "vitest";
import type { ListRow } from "../../../patterns/ListPattern";
import {
  MEETING_FILTERS,
  blankMeetingRow,
  applyMeetingFilter,
} from "./filters";

function makeRow(over: Partial<ListRow>): ListRow {
  return {
    id: crypto.randomUUID(),
    name: "회의",
    status: "active",
    owner: "",
    meetingType: "regular",
    meetingTitle: "제목",
    meetingStatus: "draft",
    ...over,
  };
}

describe("MEETING_FILTERS", () => {
  it("전체 + 유형(5) + 상태(2) chip을 노출한다", () => {
    const values = MEETING_FILTERS.map((f) => f.value);
    expect(values).toContain("all");
    expect(values).toContain("field");
    expect(values).toContain("draft");
    expect(values).toContain("sent");
  });
});

describe("blankMeetingRow", () => {
  it("신규 draft regular 행을 만든다", () => {
    const row = blankMeetingRow({ currentUserName: "송영신" });
    expect(row.id).toBe("");
    expect(row.meetingStatus).toBe("draft");
    expect(row.meetingType).toBe("regular");
    expect(row.meetingAuthor).toBe("송영신");
  });
});

describe("applyMeetingFilter", () => {
  const rows = [
    makeRow({ meetingType: "regular", meetingStatus: "draft" }),
    makeRow({ meetingType: "field", meetingStatus: "sent" }),
  ];

  it("유형으로 필터한다", () => {
    expect(applyMeetingFilter(rows, "field")).toHaveLength(1);
    expect(applyMeetingFilter(rows, "field")[0].meetingType).toBe("field");
  });

  it("상태로 필터한다", () => {
    expect(applyMeetingFilter(rows, "sent")).toHaveLength(1);
    expect(applyMeetingFilter(rows, "sent")[0].meetingStatus).toBe("sent");
  });
});
