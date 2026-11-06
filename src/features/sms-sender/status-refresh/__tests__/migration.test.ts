import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// 주석을 먼저 지운다 — 정의를 주석 처리하고도 초록이면 대조가 아니다.
const sql = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20261107_sms_status_refresh_requests.sql",
  ),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/--.*$/gm, "")
  .replace(/\s+/g, " ");

// 칸 단언은 이 테이블 정의 안에서만 본다.
const body =
  /create table if not exists public\.sms_status_refresh_requests \(([\s\S]*?)\);/.exec(
    sql,
  )?.[1] ?? "";

describe("sms_status_refresh_requests 마이그레이션", () => {
  it("테이블과 칸", () => {
    expect(sql).toContain(
      "create table if not exists public.sms_status_refresh_requests",
    );
    for (const col of [
      "id uuid primary key default gen_random_uuid()",
      "requested_at timestamptz not null default now()",
      "requested_by text not null",
      "status text not null default 'pending' check (status in ('pending','running','done','failed'))",
      "claimed_at timestamptz",
      "finished_at timestamptz",
      "message text",
      "result jsonb",
      "watermarks jsonb not null default '{}'::jsonb",
      "created_at timestamptz not null default now()",
    ])
      expect(body).toContain(col);
  });

  it("활성 1건 부분 유니크 인덱스 + pending 인덱스", () => {
    expect(sql).toMatch(
      /create unique index if not exists sms_status_refresh_requests_one_active on public\.sms_status_refresh_requests \(\(true\)\) where status in \('pending','running'\)/,
    );
    expect(sql).toMatch(
      /create index if not exists sms_status_refresh_requests_pending_idx on public\.sms_status_refresh_requests \(requested_at\) where status = 'pending'/,
    );
  });

  it("직접 읽기 금지 — RLS, 정책 없음, authenticated 회수", () => {
    expect(sql).toContain(
      "alter table public.sms_status_refresh_requests enable row level security",
    );
    expect(sql).toContain(
      "revoke all on public.sms_status_refresh_requests from public, anon, authenticated",
    );
    expect(sql).toContain(
      "grant all on public.sms_status_refresh_requests to service_role",
    );
    expect(sql).not.toMatch(/create policy/i);
  });

  it("개인정보 칸이 없다", () => {
    expect(body).not.toBe("");
    expect(body).not.toMatch(/email|phone|name/i);
  });
});
