import { describe, it, expect } from "vitest";
import { readGraphMessage, CALL_NAME } from "../graph-message";

/**
 * Graph 로 읽은 채팅 메시지에서 **명보를 부른 것만** 골라낸다.
 *
 * 봇 등록이 막혀 Graph 폴링으로 왔다(2026-08-27). 사람 계정이 읽는 구조라
 * `@멘션` 이 없으므로 **글자로 부른다** — `명보` 로 시작하면 부른 것으로 본다.
 * 방 한복판에서 "명보가 답을 안 하네" 같은 말에 끼어들면 안 되므로 규칙을 좁게 둔다.
 *
 * 본문은 HTML 로 온다(`<p>명보야 …</p>`). 태그를 안 걷으면 질문에 마크업이 섞인다.
 */
const base = {
  id: "1700000000000",
  createdDateTime: "2026-08-27T01:00:00Z",
  from: { user: { id: "aad-1", displayName: "송영신" } },
  body: { contentType: "html", content: "<p>명보야 부산대 인수인계 알려줘</p>" },
};

describe("readGraphMessage", () => {
  it("명보로 시작하면 부른 것이다", () => {
    const r = readGraphMessage(base);
    expect(r.ok && r.question).toBe("부산대 인수인계 알려줘");
  });

  it("HTML 태그를 걷어낸다 — 질문에 마크업이 섞이면 안 된다", () => {
    const r = readGraphMessage({
      ...base,
      body: { contentType: "html", content: "<div><b>명보</b> 공문 <i>번호</i></div>" },
    });
    expect(r.ok && r.question).toBe("공문 번호");
  });

  it("&nbsp; 같은 실체 참조를 푼다", () => {
    const r = readGraphMessage({
      ...base,
      body: { contentType: "html", content: "<p>명보야&nbsp;휴가 규정&nbsp;알려줘</p>" },
    });
    expect(r.ok && r.question).toBe("휴가 규정 알려줘");
  });

  it("@명보 로 불러도 받는다 — 사람들이 습관으로 @ 를 친다", () => {
    const r = readGraphMessage({ ...base, body: { contentType: "html", content: "<p>@명보 질문</p>" } });
    expect(r.ok && r.question).toBe("질문");
  });

  it("중간에 이름이 나오면 부른 게 아니다 — 남 얘기에 끼어들지 않는다", () => {
    const r = readGraphMessage({
      ...base,
      body: { contentType: "html", content: "<p>명보가 답을 안 하네요</p>" },
    });
    expect(r.ok).toBe(false);
  });

  it("이름만 있고 질문이 없으면 거절한다", () => {
    const r = readGraphMessage({ ...base, body: { contentType: "html", content: "<p>명보야</p>" } });
    expect(r.ok).toBe(false);
  });

  it("누가 물었는지 가져온다 — 이메일이 아니라 디렉터리 id다", () => {
    const r = readGraphMessage(base);
    expect(r.ok && r.aadObjectId).toBe("aad-1");
  });

  it("사람이 보낸 것만 받는다 — 앱·시스템 메시지에 답하지 않는다", () => {
    expect(readGraphMessage({ ...base, from: { application: { id: "app" } } }).ok).toBe(false);
    expect(readGraphMessage({ ...base, from: null }).ok).toBe(false);
  });

  it("삭제된 메시지는 건너뛴다", () => {
    const r = readGraphMessage({ ...base, deletedDateTime: "2026-08-27T01:01:00Z" });
    expect(r.ok).toBe(false);
  });

  it("모양이 달라도 던지지 않는다", () => {
    expect(readGraphMessage(null).ok).toBe(false);
    expect(readGraphMessage({ id: "1" }).ok).toBe(false);
  });

  it("부르는 이름이 한 곳에만 있다 — 화면 안내와 어긋나면 안 된다", () => {
    expect(CALL_NAME).toBe("명보");
  });
});
