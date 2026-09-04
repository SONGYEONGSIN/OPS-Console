import { describe, it, expect, vi } from "vitest";
import { runOnce } from "../spec-poll.mjs";

/**
 * 자택용 명세 폴러.
 *
 * 회사에 못 가는 동안 학교 명세만 자택에서 돌린다 — 명세는 저장된 raw_code 만
 * 읽어 원서GEN 에 안 붙는다(분석은 generator·entergenerator 가 회사망 밖에서
 * TCP 차단이라 못 돈다).
 *
 * **심박을 보내지 않는다.** poller_heartbeats 의 PK 가 poller_id 단독이라
 * 자택에서 보내면 회사 PC 의 dev-control 폴러가 살아 있는 것처럼 덮어쓴다 —
 * 정작 분석이 죽어 있는데 화면은 정상으로 보인다.
 */
describe("runOnce", () => {
  const base = "https://ops.example.com";

  it("명세만 집어간다 — analyze 는 자택에서 못 돈다", async () => {
    const seen = [];
    const fetchImpl = vi.fn(async (url) => {
      seen.push(String(url));
      return { ok: true, json: async () => ({ ok: true, request: null }) };
    });
    await runOnce({ base, secret: "s", fetchImpl, run: vi.fn() });
    expect(seen[0]).toContain("kind=spec");
  });

  it("심박을 보내지 않는다 — 회사 PC 가 살아 있는 척이 된다", async () => {
    const seen = [];
    const fetchImpl = vi.fn(async (url) => {
      seen.push(String(url));
      return { ok: true, json: async () => ({ ok: true, request: null }) };
    });
    await runOnce({ base, secret: "s", fetchImpl, run: vi.fn() });
    expect(seen.some((u) => u.includes("heartbeat"))).toBe(false);
  });

  it("대기 요청이 없으면 아무것도 실행하지 않는다", async () => {
    const run = vi.fn();
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({ ok: true, request: null }),
    });
    const r = await runOnce({ base, secret: "s", fetchImpl, run });
    expect(run).not.toHaveBeenCalled();
    expect(r.claimed).toBe(false);
  });

  it("집어가면 그 service_id 로 명세를 만들고 성공을 보고한다", async () => {
    const posts = [];
    const fetchImpl = async (url, init) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(init.body));
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return {
        ok: true,
        json: async () => ({
          ok: true,
          request: { id: "r1", service_id: 1130058, kind: "spec" },
        }),
      };
    };
    const run = vi.fn(() => ({ ok: true, output: "done" }));
    await runOnce({ base, secret: "s", fetchImpl, run });
    expect(run).toHaveBeenCalledWith(1130058);
    expect(posts[0]).toMatchObject({ id: "r1", ok: true });
  });

  /** 이유 없이 실패만 보고하면 손쓸 수가 없다(2026-09-04 ETIMEDOUT 사고). */
  it("실패하면 사유를 실어 보고한다", async () => {
    const posts = [];
    const fetchImpl = async (url, init) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(init.body));
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return {
        ok: true,
        json: async () => ({
          ok: true,
          request: { id: "r1", service_id: 7, kind: "spec" },
        }),
      };
    };
    const run = vi.fn(() => {
      throw new Error("claude timeout 900s");
    });
    await runOnce({ base, secret: "s", fetchImpl, run });
    expect(posts[0].ok).toBe(false);
    expect(posts[0].message).toContain("claude timeout");
  });

  /**
   * 종류를 가려 달라고 했는데 서버가 analyze 를 주면 실행하지 않는다 —
   * 구버전 서버에 붙었을 때 조용히 태우는 걸 막는다.
   */
  it("spec 이 아닌 게 오면 실행하지 않고 되돌린다", async () => {
    const posts = [];
    const fetchImpl = async (url, init) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(init.body));
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return {
        ok: true,
        json: async () => ({
          ok: true,
          request: { id: "r1", service_id: 7, kind: "analyze" },
        }),
      };
    };
    const run = vi.fn();
    await runOnce({ base, secret: "s", fetchImpl, run });
    expect(run).not.toHaveBeenCalled();
    expect(posts[0].ok).toBe(false);
    expect(posts[0].message).toMatch(/자택|analyze/);
  });

  /**
   * 실측(2026-09-04): 명세 생성이 9분 34초 걸리는 동안 execFileSync 가 이벤트
   * 루프를 막았고, 그 뒤 완료 보고 POST 가 `fetch failed` 로 죽었다. 명세는
   * 정상 저장됐는데 **요청은 failed 로 남아 화면에 실패로 보였다.**
   */
  it("보고가 실패해도 작업 성공을 실패로 뒤집지 않는다", async () => {
    const posts = [];
    let postCalls = 0;
    const fetchImpl = async (url, init) => {
      if (init?.method === "POST") {
        postCalls += 1;
        if (postCalls === 1) throw new Error("fetch failed");
        posts.push(JSON.parse(init.body));
        return { ok: true, json: async () => ({ ok: true }) };
      }
      return {
        ok: true,
        json: async () => ({
          ok: true,
          request: { id: "r1", service_id: 7, kind: "spec" },
        }),
      };
    };
    const r = await runOnce({
      base,
      secret: "s",
      fetchImpl,
      run: vi.fn(() => ({ ok: true })),
      sleep: async () => {},
    });
    expect(posts[0].ok).toBe(true);
    expect(r.ok).toBe(true);
  });

  it("보고를 끝내 못 하면 그 사실을 돌려준다 — 조용히 성공으로 두지 않는다", async () => {
    const fetchImpl = async (url, init) => {
      if (init?.method === "POST") throw new Error("fetch failed");
      return {
        ok: true,
        json: async () => ({
          ok: true,
          request: { id: "r1", service_id: 7, kind: "spec" },
        }),
      };
    };
    const r = await runOnce({
      base,
      secret: "s",
      fetchImpl,
      run: vi.fn(() => ({ ok: true })),
      sleep: async () => {},
    });
    expect(r.reported).toBe(false);
  });
});
