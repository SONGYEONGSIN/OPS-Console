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
      { name: "담당자A", email: "a@example.test", status: "active", team: "운영1팀" },
    ];
    const { db, from, select } = dbWith({ data: rows, error: null });
    await expect(loadOperatorDirectory(db)).resolves.toEqual([
      { name: "담당자A", email: "a@example.test", status: "active" },
    ]);
    expect(from).toHaveBeenCalledWith("operators");
    expect(select).toHaveBeenCalledWith("name,email,status,team");
  });

  it("영업팀은 명부에서 뺀다 — 영업자는 사고보고 메일만 받는다", async () => {
    const rows = [
      { name: "운영A", email: "a@example.test", status: "active", team: "운영1팀" },
      { name: "영업B", email: "b@example.test", status: "active", team: "영업팀" },
    ];
    const { db } = dbWith({ data: rows, error: null });
    const out = await loadOperatorDirectory(db);
    expect(out.map((o) => o.name)).toEqual(["운영A"]);
  });

  it("조회 오류는 빈 명부가 아니라 실패다", async () => {
    const { db } = dbWith({ data: null, error: { message: "boom" } });
    await expect(loadOperatorDirectory(db)).rejects.toThrow(
      "운영자 명부 조회 실패",
    );
  });
});
