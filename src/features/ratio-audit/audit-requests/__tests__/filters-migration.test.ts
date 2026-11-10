import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 주석을 먼저 지운다 — 정의를 주석 처리하고도 초록이면 대조가 아니다.
const body = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261110_ratio_audit_request_filters.sql",
  ),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/--.*$/gm, "")
  .replace(/\s+/g, " ")
  .trim();

describe("ratio_audit_requests.filters 마이그레이션", () => {
  it("filters 칸을 nullable jsonb 로 더한다", () => {
    expect(body).toContain(
      "alter table public.ratio_audit_requests add column if not exists filters jsonb;",
    );
    expect(body).not.toMatch(/filters jsonb not null/);
  });

  it("조건 없이 대기 중인 요청만 마감한다", () => {
    expect(body).toMatch(
      /update public\.ratio_audit_requests set status = 'failed', finished_at = now\(\), message = '[^']+' where status = 'pending' and filters is null;/,
    );
  });

  it("제약·정책은 건드리지 않는다", () => {
    expect(body).not.toMatch(
      /add constraint|create policy|drop policy|revoke|grant/i,
    );
  });

  it("트랜잭션 + 스키마 캐시 갱신", () => {
    expect(body).toMatch(/^begin;/);
    expect(body).toContain("notify pgrst, 'reload schema'; commit;");
  });
});
