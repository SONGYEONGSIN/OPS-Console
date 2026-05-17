import { describe, it, expect } from "vitest";
import { ownProfileUpdateSchema } from "../schemas";

describe("ownProfileUpdateSchema", () => {
  it("name 1자 이상 통과", () => {
    expect(ownProfileUpdateSchema.safeParse({ name: "송영석" }).success).toBe(
      true,
    );
  });

  it("name 빈 — 거부", () => {
    expect(ownProfileUpdateSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("name 40자 초과 — 거부", () => {
    expect(
      ownProfileUpdateSchema.safeParse({ name: "x".repeat(41) }).success,
    ).toBe(false);
  });

  it("권한 등 다른 필드는 허용 안 함 (extra field strip)", () => {
    const parsed = ownProfileUpdateSchema.safeParse({
      name: "송영석",
      permission: "admin",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect("permission" in parsed.data).toBe(false);
  });
});

describe("updateOwnProfile — export 시그니처", () => {
  it("async 함수", async () => {
    const mod = await import("../actions");
    expect(mod.updateOwnProfile.constructor.name).toBe("AsyncFunction");
  });
});
