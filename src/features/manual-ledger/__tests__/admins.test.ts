import { describe, expect, it } from "vitest";
import { parseAdminEmails } from "../admins";

describe("parseAdminEmails", () => {
  it("쉼표로 나눠 소문자로, 메일 모양만, 중복 없이", () => {
    expect(
      parseAdminEmails(
        " A@example.test , b@example.test,not-mail,, a@example.test",
      ),
    ).toEqual(["a@example.test", "b@example.test"]);
  });

  it("없으면 빈 목록", () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails("")).toEqual([]);
  });
});
