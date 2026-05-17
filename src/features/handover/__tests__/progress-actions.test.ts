import { describe, it, expect } from "vitest";
import { handoverProgressCreateSchema } from "../progress-schemas";

// progress-actions.ts는 server-only. 여기선 schema 검증/payload 형상만 단위 테스트.
// 실 server action 통합은 e2e 또는 별도 integration 시나리오에서.
describe("handover progress actions — payload shape", () => {
  it("createHandoverProgress 입력은 schema 통과해야 한다", () => {
    const ok = handoverProgressCreateSchema.safeParse({
      service_id: "11111111-1111-4111-8111-111111111111",
      to_email: "to@x.com",
      to_name: "수신자",
      notes: "참고",
    });
    expect(ok.success).toBe(true);
  });

  it("notes 미지정 OK (선택 필드)", () => {
    const ok = handoverProgressCreateSchema.safeParse({
      service_id: "11111111-1111-4111-8111-111111111111",
      to_email: "to@x.com",
      to_name: "수신자",
    });
    expect(ok.success).toBe(true);
  });
});
