import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { loadOperatorDirectory } from "../operators";

function dbWith(result: { data: unknown; error: { message: string } | null }) {
  const select = vi.fn(async () => result);
  const from = vi.fn(() => ({ select }));
  return { db: { from } as unknown as SupabaseClient, from, select };
}

describe("loadOperatorDirectory", () => {
  it("이름·메일·상태를 읽는다", async () => {
    const rows = [
      { name: "담당자A", email: "a@example.test", status: "active" },
    ];
    const { db, from, select } = dbWith({ data: rows, error: null });
    await expect(loadOperatorDirectory(db)).resolves.toEqual(rows);
    expect(from).toHaveBeenCalledWith("operators");
    expect(select).toHaveBeenCalledWith("name,email,status");
  });

  it("조회 오류는 빈 명부가 아니라 실패다", async () => {
    const { db } = dbWith({ data: null, error: { message: "boom" } });
    await expect(loadOperatorDirectory(db)).rejects.toThrow(
      "운영자 명부 조회 실패",
    );
  });
});
