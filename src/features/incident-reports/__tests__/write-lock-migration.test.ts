import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { incidentReportUpdateSchema } from "../schemas";

/**
 * 경위서 쓰기 잠금 마이그레이션 원문을 코드와 대조한다.
 *
 * authenticated 가 고칠 수 있는 칸(칼럼 grant)은 `incidentReportUpdateSchema` 의 키 +
 * `updated_at` 과 같아야 한다 — 편집 칸을 스키마에만 넣고 grant 를 잊으면 저장이 42501 로
 * 깨지고, grant 에만 넣으면 PostgREST 로 그 칸이 열린다. 둘을 이 테스트 하나로 묶는다.
 *
 * 주석은 **먼저** 지운다 — 정의를 주석 처리하고도 초록이 되는 일을 막는다.
 * 설계: docs/superpowers/specs/2026-11-26-incident-write-permissions-design.md §8-1
 */
const FILE = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20261126_incident_reports_write_lock.sql",
);

function stripSqlComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

/** 주석을 지우고 공백을 한 칸으로 접은 원문. */
function sql(): string {
  return stripSqlComments(readFileSync(FILE, "utf8"))
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** 문장 단위(`;`) — 칼럼·테이블 단언을 한 문장 안에서만 본다. */
function statements(): string[] {
  return sql()
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

const TABLE = "public.incident_reports";

/** §3 보호 칸 — 서버(service_role)만 쓴다. grant 목록에 하나라도 있으면 안 된다. */
const PROTECTED = [
  "id",
  "incident_id",
  "service_name",
  "draft_date",
  "author_name",
  "author_email",
  "approver_name",
  "approver_email",
  "approver_role",
  "director_name",
  "director_role",
  "ceo_name",
  "ceo_role",
  "status",
  "reject_reason",
  "approved_at",
  "recipient_emails",
  "doc_number",
  "sharepoint_url",
  "created_at",
];

function grantUpdateColumns(): string[] {
  const stmt = statements().find((s) =>
    new RegExp(
      `^grant update \\(.*\\) on ${TABLE.replace(".", "\\.")} to authenticated$`,
    ).test(s),
  );
  const list = stmt ? (/^grant update \(([^)]*)\)/.exec(stmt)?.[1] ?? "") : "";
  return list
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
}

/** update 정책의 using / with check 본문. */
function updatePolicy(): { using: string; check: string } {
  const stmt =
    statements().find((s) =>
      s.startsWith(`create policy incident_reports_update on ${TABLE}`),
    ) ?? "";
  const m = /using \((.*)\) with check \((.*)\)$/.exec(stmt);
  return { using: m?.[1] ?? "", check: m?.[2] ?? "" };
}

/** grant·revoke 문 — 칼럼 목록은 정렬해 순서와 무관하게 비교한다. */
function privilegeStatements(): string[] {
  return statements()
    .filter((s) => /^(grant|revoke) /.test(s))
    .map((s) =>
      s.replace(
        /\(([^)]*)\)/,
        (_, list: string) =>
          `(${list
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
            .sort()
            .join(", ")})`,
      ),
    );
}

describe("20261126_incident_reports_write_lock.sql", () => {
  it("grant·revoke 문은 정확히 이 넷뿐이다 — PUBLIC·anon 경유 권한도 새지 않는다", () => {
    const cols = [
      ...Object.keys(incidentReportUpdateSchema.shape),
      "updated_at",
    ].sort();
    expect(privilegeStatements()).toEqual([
      `revoke all on ${TABLE} from public, anon, authenticated`,
      `grant select on ${TABLE} to authenticated`,
      `grant update (${cols.join(", ")}) on ${TABLE} to authenticated`,
      `grant all on ${TABLE} to service_role`,
    ]);
  });

  it("RLS 를 켠다(멱등) — 정책이 있어도 꺼져 있으면 아무것도 안 막는다", () => {
    expect(statements()).toContain(
      `alter table ${TABLE} enable row level security`,
    );
  });

  it("authenticated 의 update grant 칸 = 갱신 스키마 키 + updated_at (단일 원천)", () => {
    const expected = [
      ...Object.keys(incidentReportUpdateSchema.shape),
      "updated_at",
    ].sort();
    expect(grantUpdateColumns().sort()).toEqual(expected);
  });

  it("보호 칸 20개는 grant 목록에 하나도 없다", () => {
    expect(PROTECTED).toHaveLength(20);
    const cols = grantUpdateColumns();
    expect(cols.length).toBeGreaterThan(0);
    for (const c of PROTECTED) expect(cols).not.toContain(c);
  });

  it("revoke all … from public, anon, authenticated 가 모든 grant 보다 앞이다", () => {
    const stmts = statements();
    const revokeIdx = stmts.indexOf(
      `revoke all on ${TABLE} from public, anon, authenticated`,
    );
    expect(revokeIdx).toBeGreaterThanOrEqual(0);
    const grantIdxs = stmts
      .map((s, i) => (s.startsWith("grant ") ? i : -1))
      .filter((i) => i >= 0);
    expect(grantIdxs.length).toBeGreaterThan(0);
    for (const i of grantIdxs) expect(i).toBeGreaterThan(revokeIdx);
  });

  it("authenticated 에게 insert·delete·테이블 단위 update·all 을 주지 않는다", () => {
    const toAuth = statements().filter(
      (s) => s.startsWith("grant ") && /\bto (.*\b)?authenticated\b/.test(s),
    );
    // select 와 칼럼 update 둘뿐
    expect(toAuth).toEqual([
      `grant select on ${TABLE} to authenticated`,
      expect.stringMatching(/^grant update \(/),
    ]);
    for (const s of toAuth) {
      expect(s).not.toMatch(/\binsert\b/);
      expect(s).not.toMatch(/\bdelete\b/);
      expect(s).not.toMatch(/^grant all\b/);
      expect(s).not.toMatch(/^grant update on\b/);
    }
  });

  it("insert·delete 정책은 drop 만 있고 create 가 없다", () => {
    const text = sql();
    for (const name of ["incident_reports_insert", "incident_reports_delete"]) {
      expect(text).toContain(`drop policy if exists ${name} on ${TABLE}`);
      expect(text).not.toContain(`create policy ${name}`);
    }
  });

  it("update 정책: using·with check 모두 작성 중·반려 + 작성자/admin, 승인자는 없다", () => {
    const { using, check } = updatePolicy();
    for (const body of [using, check]) {
      expect(body).toContain("status in ('draft', 'rejected')");
      expect(body).toContain("author_email = (select auth.jwt() ->> 'email')");
      expect(body).toContain("(select public.is_admin())");
      expect(body).not.toContain("approver_email");
    }
  });

  it("정책은 authenticated 에게만, 스키마 캐시를 다시 읽힌다", () => {
    expect(sql()).toContain(
      `create policy incident_reports_update on ${TABLE} for update to authenticated`,
    );
    expect(sql()).toContain("notify pgrst, 'reload schema'");
  });
});
