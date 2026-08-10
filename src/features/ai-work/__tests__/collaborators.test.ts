import { describe, it, expect } from "vitest";
import { normalizeCollaborators } from "../collaborators";

describe("normalizeCollaborators", () => {
  it("중복을 제거한다", () => {
    expect(
      normalizeCollaborators(["a@x.com", "b@x.com", "a@x.com"], "me@x.com"),
    ).toEqual(["a@x.com", "b@x.com"]);
  });

  it("등록자 본인은 제거한다", () => {
    expect(normalizeCollaborators(["a@x.com", "me@x.com"], "me@x.com")).toEqual(
      ["a@x.com"],
    );
  });

  it("선택한 순서를 유지한다", () => {
    expect(
      normalizeCollaborators(["c@x.com", "a@x.com", "b@x.com"], "me@x.com"),
    ).toEqual(["c@x.com", "a@x.com", "b@x.com"]);
  });

  it("undefined는 빈 배열이 된다", () => {
    expect(normalizeCollaborators(undefined, "me@x.com")).toEqual([]);
  });

  it("빈 배열은 빈 배열이다", () => {
    expect(normalizeCollaborators([], "me@x.com")).toEqual([]);
  });

  it("입력 배열을 변형하지 않는다", () => {
    const input = ["a@x.com", "a@x.com"];
    normalizeCollaborators(input, "me@x.com");
    expect(input).toEqual(["a@x.com", "a@x.com"]);
  });
});
