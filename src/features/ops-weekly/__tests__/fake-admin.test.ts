import { describe, it, expect } from "vitest";
import { fakeAdmin } from "./fake-admin";

const rowsOf = async (q: PromiseLike<{ data: unknown }>) =>
  (await q).data as Record<string, unknown>[];

describe("fakeAdmin (테스트 도우미 자체 검증)", () => {
  it("eq·in 을 실제로 적용해 거른다", async () => {
    const db = fakeAdmin({
      t: [
        { k: "a", g: 1 },
        { k: "b", g: 1 },
        { k: "c", g: 2 },
      ],
    });
    expect(await rowsOf(db.client.from("t").select().eq("g", 1))).toHaveLength(
      2,
    );
    expect(
      await rowsOf(db.client.from("t").select().in("k", ["a", "c"])),
    ).toHaveLength(2);
  });

  it("upsert ignoreDuplicates — 충돌 키가 같으면 건너뛴다", async () => {
    const db = fakeAdmin({ t: [{ k: "a", v: 1 }] });
    await db.client
      .from("t")
      .upsert({ k: "a", v: 2 }, { onConflict: "k", ignoreDuplicates: true });
    expect(db.rows("t")).toEqual([{ k: "a", v: 1 }]);
  });

  it("insert 는 id 를 채우고, update().eq().select() 는 바뀐 행을 돌려준다", async () => {
    const db = fakeAdmin({ t: [] });
    await db.client.from("t").insert([{ k: "a" }]);
    expect(db.rows("t")[0].id).toBe("t-1");
    const res = await rowsOf(
      db.client.from("t").update({ k: "z" }).eq("k", "a").select(),
    );
    expect(res).toEqual([{ id: "t-1", k: "z" }]);
  });

  it("failTable 은 모든 응답을 error 로, failNextWrite 는 쓰기 한 번만", async () => {
    const db = fakeAdmin({ t: [] });
    db.failNextWrite("t", "boom", "23505");
    const bad = await db.client.from("t").insert({ k: "a" });
    expect(bad.error).toEqual({ message: "boom", code: "23505" });
    const ok = await db.client.from("t").insert({ k: "a" });
    expect(ok.error).toBeNull();
    db.failTable("t", "x");
    expect((await db.client.from("t").select()).error).toEqual({
      message: "x",
    });
  });
});
