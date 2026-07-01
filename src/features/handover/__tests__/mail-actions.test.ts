import { describe, it, expect } from "vitest";
import { buildHandoverMailSubject } from "../mail-template";

// mail-actions.ts는 server-only + 외부 의존(Graph API/Supabase). 단위 테스트는
// pure mail-template와 html-document 모듈로 충분히 커버되므로 여기선 subject 형상만 확인.
describe("handover mail actions — surface", () => {
  it("subject 형식 stable", () => {
    expect(
      buildHandoverMailSubject({
        universityName: "한예종",
        serviceName: "KARTS",
      }),
    ).toBe("[운영부 상황실] 인수인계 요청 — 한예종 · KARTS");
  });
});
