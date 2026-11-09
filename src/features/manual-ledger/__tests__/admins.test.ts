import { describe, expect, it } from "vitest";
import { parseAdminEmails } from "../admins";

describe("parseAdminEmails", () => {
  it("쉼표로 나눠 소문자로, 빈 칸은 무시하고 중복 없이", () => {
    expect(
      parseAdminEmails(" A@example.test , b@example.test,, a@example.test,"),
    ).toEqual(["a@example.test", "b@example.test"]);
  });

  it("메일 모양이 아닌 값이 하나라도 있으면 설정 오류(null)다 — 조용히 빼지 않는다", () => {
    expect(parseAdminEmails("a@example.test,not-mail")).toBeNull();
  });

  it("없으면 빈 목록", () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails("")).toEqual([]);
  });
});
