import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 사고 삭제 정책 원문 대조 — 승인·발송된 경위서가 있는 사고는 admin 만 지운다.
 *
 * 경위서는 사고 삭제의 FK cascade 로, 그 발송 이력은 다시 cascade 로 지워진다. 담당자 본인이라도
 * 발송까지 끝난 공문 기록을 혼자 지우지 못하게 한다. 앱 `deleteIncident` 가 같은 조건을 먼저 본다.
 *
 * 주석은 **먼저** 지운다 — 정의를 주석 처리하고도 초록이 되는 일을 막는다.
 * 설계: docs/superpowers/specs/2026-11-26-incident-write-permissions-design.md §5·§6-2
 */
const FILE = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20261126c_incidents_delete_reported_admin_only.sql",
);

function stripSqlComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

function statements(): string[] {
  return stripSqlComments(readFileSync(FILE, "utf8"))
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

const POLICY = '"incidents_delete_admin_or_assignee"';

function createPolicy(): string {
  return (
    statements().find((s) =>
      s.startsWith(`create policy ${POLICY} on public.incidents`),
    ) ?? ""
  );
}

describe("20261126c_incidents_delete_reported_admin_only.sql", () => {
  it("RLS 를 켠다(멱등)", () => {
    expect(statements()).toContain(
      "alter table public.incidents enable row level security",
    );
  });

  it("같은 이름의 삭제 정책을 지우고 다시 만든다 — authenticated 의 delete 에만", () => {
    const stmts = statements();
    const drop = stmts.indexOf(
      `drop policy if exists ${POLICY} on public.incidents`,
    );
    const create = stmts.findIndex((s) =>
      s.startsWith(`create policy ${POLICY} on public.incidents`),
    );
    expect(drop).toBeGreaterThanOrEqual(0);
    expect(create).toBeGreaterThan(drop);
    expect(createPolicy()).toContain("for delete to authenticated using (");
    // 삭제 정책은 이것 하나 — 다른 delete 정책이 OR 로 열어 주지 않는다
    expect(
      stmts.filter((s) => /^create policy .* for delete /.test(s)),
    ).toHaveLength(1);
  });

  it("admin 은 그대로, 비admin 은 담당자 본인 + 승인·발송된 경위서가 없을 때만", () => {
    const p = createPolicy();
    expect(p).toContain("(select public.is_admin())");
    expect(p).toContain("assignee_email = (select auth.jwt() ->> 'email')");
    expect(p).toMatch(
      /and not exists \( ?select 1 from public\.incident_reports r where r\.incident_id = incidents\.id and r\.status in \('approved', 'sent'\) ?\)/,
    );
  });

  it("is_admin()·auth.jwt() 는 (select …) 로 감싼다 — 맨 호출은 행마다 평가된다", () => {
    const p = createPolicy();
    expect(p.replace(/\(select public\.is_admin\(\)\)/g, "")).not.toContain(
      "is_admin()",
    );
    expect(
      p.replace(/\(select auth\.jwt\(\) ->> 'email'\)/g, ""),
    ).not.toContain("auth.jwt()");
  });

  it("스키마 캐시를 다시 읽힌다", () => {
    expect(statements()).toContain("notify pgrst, 'reload schema'");
  });
});

/**
 * 삭제 정책의 `not exists (select … from incident_reports …)` 는 호출자 권한으로 돈다.
 * 경위서 select 정책이 좁아지면 숨은 approved·sent 행을 못 봐 '없음' 이 되고, 담당자 본인이
 * 발송된 사고를 지울 수 있게 된다(실측 확인). 그래서 그 정책의 최종 상태를 여기서 고정한다.
 */
describe("20261126c 가 기대는 경위서 select 정책", () => {
  const DIR = join(process.cwd(), "supabase", "migrations");

  /** 모든 마이그레이션을 파일명 순으로 — incident_reports_read 를 만들거나·바꾸거나·지우는 문장만. */
  function readPolicyEvents(): { file: string; stmt: string }[] {
    return readdirSync(DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .flatMap((file) =>
        stripSqlComments(readFileSync(join(DIR, file), "utf8"))
          .replace(/\s+/g, " ")
          .toLowerCase()
          .split(";")
          .map((stmt) => stmt.trim())
          .filter((stmt) =>
            /^(create|alter|drop) policy (if exists )?"?incident_reports_read"? /.test(
              stmt,
            ),
          )
          .map((stmt) => ({ file, stmt })),
      );
  }

  it("incident_reports_read 의 마지막 정의는 for select to authenticated using (true)", () => {
    const events = readPolicyEvents();
    const last = events.at(-1);
    expect(
      last?.stmt,
      `20261126c 삭제 정책이 이 정책에 기대고 있다 — 승인·발송 경위서가 안 보이면 담당자가 그 사고를 지울 수 있다. 좁히려면 삭제 정책부터 바꿀 것 (마지막 정의: ${last?.file ?? "없음"})`,
    ).toBe(
      "create policy incident_reports_read on public.incident_reports for select to authenticated using (true)",
    );
  });
});
