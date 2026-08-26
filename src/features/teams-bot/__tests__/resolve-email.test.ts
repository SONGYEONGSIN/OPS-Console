import { describe, it, expect, vi, beforeEach } from "vitest";
import { emailFromAadObjectId } from "../resolve-email";

/**
 * Teams 는 **이메일을 주지 않는다.** Activity 의 `from.aadObjectId` 는 Entra 객체 id 라,
 * 운영자 명부(`operators.email`)와 대조하려면 Graph 로 한 번 바꿔야 한다
 * (2026-08-26 실측: 객체 id → mail/userPrincipalName 조회 200).
 *
 * `mail` 이 비어 있는 계정이 있어 `userPrincipalName` 으로 물러선다.
 */
const graph = vi.fn();
vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: () => Promise.resolve("token"),
}));

beforeEach(() => {
  graph.mockReset();
  vi.stubGlobal("fetch", graph);
});

function reply(status: number, body: unknown) {
  return Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(body) });
}

describe("emailFromAadObjectId", () => {
  it("메일 주소를 돌려준다", async () => {
    graph.mockReturnValue(reply(200, { mail: "a@x.com", userPrincipalName: "a@x.com" }));
    expect(await emailFromAadObjectId("aad-1")).toBe("a@x.com");
  });

  it("mail 이 비면 UPN 으로 물러선다 — 메일함 없는 계정이 있다", async () => {
    graph.mockReturnValue(reply(200, { mail: null, userPrincipalName: "b@x.com" }));
    expect(await emailFromAadObjectId("aad-1")).toBe("b@x.com");
  });

  it("못 찾으면 null — 아무 이름이나 지어내지 않는다", async () => {
    graph.mockReturnValue(reply(404, {}));
    expect(await emailFromAadObjectId("없음")).toBeNull();
  });

  it("Graph 가 죽어도 던지지 않는다 — 채팅 한 건 때문에 라우트가 500 이 되면 안 된다", async () => {
    graph.mockRejectedValue(new Error("network"));
    expect(await emailFromAadObjectId("aad-1")).toBeNull();
  });

  it("객체 id 를 그대로 주소에 넣지 않는다 — 경로 조작을 막는다", async () => {
    graph.mockReturnValue(reply(200, { mail: "a@x.com" }));
    await emailFromAadObjectId("../../me");
    const url = String(graph.mock.calls[0][0]);
    expect(url).not.toContain("../");
  });
});
