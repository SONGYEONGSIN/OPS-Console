import { describe, it, expect } from "vitest";
import { meetingToListRow } from "../_row-mapper";
import type { MeetingRow } from "@/features/meetings/schemas";

const sample: MeetingRow = {
  id: "11111111-1111-4111-8111-111111111111",
  type: "regular",
  title: "주간 운영 회의",
  meeting_date: "2026-06-10 14:00",
  location: "본사 3층",
  attendees: ["송영신", "이해영"],
  author_email: "ys@example.com",
  status: "draft",
  content: [],
  sharepoint_url: null,
  created_at: "2026-06-10T00:00:00Z",
  updated_at: "2026-06-10T00:00:00Z",
};

describe("meetingToListRow", () => {
  it("MeetingRow를 ListRow meeting* 필드로 매핑한다", () => {
    const row = meetingToListRow(sample);

    expect(row.id).toBe(sample.id);
    expect(row.name).toBe("주간 운영 회의");
    expect(row.meetingTitle).toBe("주간 운영 회의");
    expect(row.meetingType).toBe("regular");
    expect(row.meetingDate).toBe("2026-06-10 14:00");
    expect(row.meetingAuthor).toBe("ys@example.com");
    expect(row.meetingStatus).toBe("draft");
  });

  it("status는 항상 active (목록 필터 무관) — 작성상태는 meetingStatus", () => {
    const row = meetingToListRow(sample);
    expect(row.status).toBe("active");
  });

  it("제목이 비어 있으면 name은 '(제목 없음)'", () => {
    const row = meetingToListRow({ ...sample, title: "" });
    expect(row.name).toBe("(제목 없음)");
    expect(row.meetingTitle).toBe("");
  });

  it("meeting_date가 없으면 meetingDate는 null", () => {
    const row = meetingToListRow({ ...sample, meeting_date: null });
    expect(row.meetingDate).toBeNull();
  });

  it("authorName이 주어지면 meetingAuthor는 등록 이름, owner는 이메일 유지", () => {
    const row = meetingToListRow(sample, "송영신");
    expect(row.meetingAuthor).toBe("송영신");
    expect(row.owner).toBe("ys@example.com");
  });

  it("authorName이 없으면 meetingAuthor는 이메일로 폴백", () => {
    const row = meetingToListRow(sample);
    expect(row.meetingAuthor).toBe("ys@example.com");
  });
});
