import { describe, it, expect } from "vitest";
import { contractUpdateSchema } from "../schemas";

describe("contracts actions surface", () => {
  it("contractUpdateSchema — 정상 입력 통과", () => {
    const r = contractUpdateSchema.safeParse({
      sheet: "4년제",
      cellAddress: "F12",
      value: "기자의",
    });
    expect(r.success).toBe(true);
  });

  it("contractUpdateSchema — invalid cellAddress reject", () => {
    const r = contractUpdateSchema.safeParse({
      sheet: "4년제",
      cellAddress: "12F",
      value: "x",
    });
    expect(r.success).toBe(false);
  });

  it("contractUpdateSchema — value 500자 초과 reject", () => {
    const r = contractUpdateSchema.safeParse({
      sheet: "4년제",
      cellAddress: "F12",
      value: "x".repeat(501),
    });
    expect(r.success).toBe(false);
  });
});
