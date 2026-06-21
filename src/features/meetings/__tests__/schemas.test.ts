import { describe, it, expect } from "vitest";
import { MEETING_TYPES, MEETING_TYPE_LABELS, MEETING_STATUS_LABELS, meetingRowSchema } from "../schemas";

describe("meeting enums", () => {
  it("유형 5종 + 한글 라벨", () => {
    expect(MEETING_TYPES).toEqual(["regular", "field", "project", "memo", "urgent"]);
    expect(MEETING_TYPE_LABELS.field).toBe("외근·출장 보고");
  });
  it("상태 라벨", () => {
    expect(MEETING_STATUS_LABELS.draft).toBe("작성중");
    expect(MEETING_STATUS_LABELS.sent).toBe("발송완료");
  });
});
describe("meetingRowSchema", () => {
  const valid = {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    type: "field",
    title: "부산대 미팅",
    meeting_date: "2026-06-14T04:30:00Z",
    location: "부산대",
    attendees: ["송영신"],
    author_email: "a@b.com",
    status: "draft",
    content: [],
    sharepoint_url: null,
    created_at: "2026-06-14T00:00:00Z",
    updated_at: "2026-06-14T00:00:00Z",
  };
  it("정상 파싱", () => {
    expect(meetingRowSchema.safeParse(valid).success).toBe(true);
  });
  it("잘못된 type 거부", () => {
    expect(meetingRowSchema.safeParse({ ...valid, type: "x" }).success).toBe(false);
  });
  it("v2 양식 content(객체)도 파싱", () => {
    const v2 = { ...valid, content: { formVersion: 2, typeId: "field", sections: [] } };
    expect(meetingRowSchema.safeParse(v2).success).toBe(true);
  });
});
