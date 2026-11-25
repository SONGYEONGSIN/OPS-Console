import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SEVERITY_VALUES } from "../schemas";

/**
 * 사고 등급 마이그레이션 원문을 코드 상수와 대조한다.
 *
 * 쿼리·action 테스트는 mock 에 대고 단언해서, DB CHECK 의 등급 목록이 코드와
 * 어긋나도 초록인 채로 프로덕션 insert 가 23514 로 죽는다. 그래서 두 CHECK 의
 * `in (…)` 목록을 `SEVERITY_VALUES` 하나에 묶는다.
 *
 * 주석은 **먼저** 지운다 — 정의를 주석 처리하고도 초록이 되는 일을 막는다
 * (`assignments/__tests__/migration-contract.test.ts` 의 `stripSqlComments` 와 같은 규칙).
 */
const FILE = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20261125_incident_severity.sql",
);

function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

/** 주석을 지우고 공백을 한 칸으로 접은 원문. */
function sql(): string {
  return stripSqlComments(readFileSync(FILE, "utf8")).replace(/\s+/g, " ");
}

function quotedList(body: string): string[] {
  return [...body.matchAll(/'([^']*)'/g)].map((m) => m[1]);
}

const TABLE = "public.incident_severity_criteria";

describe("20261125_incident_severity.sql", () => {
  it("incidents.severity 는 nullable text 로 추가한다 (기존 행 NULL)", () => {
    expect(sql()).toMatch(
      /alter table public\.incidents add column if not exists severity text ?;/,
    );
  });

  it("두 CHECK 의 등급 목록이 SEVERITY_VALUES 와 같다", () => {
    const lists = [...sql().matchAll(/severity in \(([^)]*)\)/g)].map((m) =>
      quotedList(m[1]),
    );
    expect(lists).toHaveLength(2);
    for (const list of lists) expect(list).toEqual([...SEVERITY_VALUES]);
  });

  it("incidents CHECK 는 NULL 을 허용한다", () => {
    expect(sql()).toMatch(
      /add constraint incidents_severity_check check \(severity is null or severity in \(/,
    );
  });

  it("기준 표는 RLS 를 켜고 authenticated 에는 select 만 준다", () => {
    const s = sql();
    expect(s).toContain(`alter table ${TABLE} enable row level security;`);
    expect(s).toContain(
      `revoke all on ${TABLE} from public, anon, authenticated;`,
    );
    expect(s).toContain(`grant select on ${TABLE} to authenticated;`);
    expect(s).toContain(`grant all on ${TABLE} to service_role;`);
    expect(s).toMatch(
      /create policy "incident_severity_criteria_select" on public\.incident_severity_criteria for select to authenticated using \(true\);/,
    );
  });

  it("authenticated 에 쓰기 권한을 주지 않는다", () => {
    expect(sql()).not.toMatch(
      /grant (insert|update|delete|all)[^;]* to authenticated/,
    );
  });

  it("seed 가 4등급 기본 문구를 담는다", () => {
    const s = sql();
    for (const phrase of [
      "5,771명 오발송",
      "재발번·문자 안내",
      "강제접수",
      "접수 전 수정",
    ]) {
      expect(s).toContain(phrase);
    }
    expect(s).toContain("on conflict (severity) do nothing;");
  });

  it("PostgREST 스키마 캐시를 다시 읽힌다", () => {
    expect(sql()).toContain("notify pgrst, 'reload schema';");
  });
});
