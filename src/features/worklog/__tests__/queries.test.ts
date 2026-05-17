import { describe, it, expect } from "vitest";
import { mapWorklogToLogLine } from "../queries";

describe("mapWorklogToLogLine", () => {
  it("user_name 있으면 'user · msg' 형식", () => {
    const r = mapWorklogToLogLine({
      id: "p1",
      created_at: "2026-05-17T01:23:45Z",
      level: "INFO",
      user_email: "x@y.com",
      user_name: "송영신",
      domain: "handover",
      action: "create",
      target_type: null,
      target_id: null,
      target_name: "한예종",
      msg: "인계 생성",
      metadata: null,
    });
    expect(r.level).toBe("INFO");
    expect(r.msg).toContain("송영신");
    expect(r.msg).toContain("handover");
    expect(r.msg).toContain("create");
    expect(r.msg).toContain("인계 생성");
  });

  it("user_name 없으면 system으로 표기", () => {
    const r = mapWorklogToLogLine({
      id: "p2",
      created_at: "2026-05-17T00:00:00Z",
      level: "WARN",
      user_email: null,
      user_name: null,
      domain: "incidents",
      action: "delete",
      target_type: null,
      target_id: null,
      target_name: null,
      msg: "삭제",
      metadata: null,
    });
    expect(r.msg).toContain("system");
  });
});
