import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockToken } = vi.hoisted(() => ({ mockToken: vi.fn() }));
vi.mock("../delegated-token", () => ({ getDelegatedGraphToken: mockToken }));

import { sendTeamsChatMessage, listMyChats } from "../teams";

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("sendTeamsChatMessage", () => {
  it("위임 토큰을 Teams 스코프(Chat.ReadWrite)로 요청하고 /chats/{id}/messages에 html POST", async () => {
    mockToken.mockResolvedValue("tok-123");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "msg-1" }), { status: 201 }),
      );

    const r = await sendTeamsChatMessage({
      operatorEmail: "me@x.com",
      chatId: "19:abc@thread.v2",
      html: "<b>hi</b>",
    });

    expect(r).toEqual({ id: "msg-1" });
    // 스코프에 Chat.ReadWrite 포함
    expect(mockToken).toHaveBeenCalledWith(
      "me@x.com",
      expect.objectContaining({ scope: expect.stringContaining("Chat.ReadWrite") }),
    );
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain(
      "/chats/19%3Aabc%40thread.v2/messages",
    );
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body.body).toEqual({ contentType: "html", content: "<b>hi</b>" });
  });

  it("위임 토큰 없으면 에러", async () => {
    mockToken.mockResolvedValue(null);
    await expect(
      sendTeamsChatMessage({ operatorEmail: "me@x.com", chatId: "c", html: "x" }),
    ).rejects.toThrow(/위임 토큰/);
  });

  it("Graph 오류 응답이면 throw", async () => {
    mockToken.mockResolvedValue("tok");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("forbidden", { status: 403 }),
    );
    await expect(
      sendTeamsChatMessage({ operatorEmail: "me@x.com", chatId: "c", html: "x" }),
    ).rejects.toThrow(/403/);
  });
});

describe("listMyChats", () => {
  it("/me/chats 조회 후 id/topic/chatType 매핑", async () => {
    mockToken.mockResolvedValue("tok");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          value: [
            { id: "19:a@thread.v2", topic: "주간보고", chatType: "group" },
            { id: "19:b", chatType: "oneOnOne" },
          ],
        }),
        { status: 200 },
      ),
    );
    const chats = await listMyChats("me@x.com");
    expect(chats).toEqual([
      { id: "19:a@thread.v2", topic: "주간보고", chatType: "group" },
      { id: "19:b", topic: null, chatType: "oneOnOne" },
    ]);
  });
});
