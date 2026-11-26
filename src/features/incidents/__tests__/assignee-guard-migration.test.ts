import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { incidentUpdateSchema } from "../schemas";

/**
 * 사고 담당자 잠금 마이그레이션 원문 대조.
 *
 * 담당자를 본인으로 바꾸면 삭제 정책(admin OR assignee)을 통과해 남의 사고와 그 경위서(cascade)를
 * 지울 수 있었다. 트리거가 authenticated·anon 의 assignee_* 변경을 42501 로 막는다.
 * 앱이 담당자를 보내기 시작하면 트리거에 막히므로 `incidentUpdateSchema` 에 그 키가 없다는 것도 함께 묶는다.
 *
 * 주석은 **먼저** 지운다 — 정의를 주석 처리하고도 초록이 되는 일을 막는다.
 * 설계: docs/superpowers/specs/2026-11-26-incident-write-permissions-design.md §5·§6-2
 */
const FILE = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20261126b_incidents_assignee_guard.sql",
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

/** `create or replace function public.incidents_guard_assignee(` ~ `$$;` */
function fnDef(): string {
  return (
    /create or replace function public\.incidents_guard_assignee\(\)(.*?)\$\$;/.exec(
      sql(),
    )?.[1] ?? ""
  );
}

describe("20261126b_incidents_assignee_guard.sql", () => {
  it("authenticated·anon 만 막는다 — service_role·postgres 는 통과", () => {
    expect(fnDef()).toContain("current_user in ('authenticated', 'anon')");
  });

  it("두 칸 모두 옛 값과 비교한다", () => {
    const fn = fnDef();
    expect(fn).toContain(
      "new.assignee_email is distinct from old.assignee_email",
    );
    expect(fn).toContain(
      "new.assignee_name is distinct from old.assignee_name",
    );
  });

  it("42501 로 거절한다 — PostgREST 가 403 으로 돌려준다", () => {
    expect(fnDef()).toMatch(/raise exception '[^']+' using errcode = '42501'/);
  });

  it("security definer 가 아니다 — current_user 가 소유자로 바뀌면 아무도 안 막힌다", () => {
    expect(fnDef()).toContain("returns trigger");
    expect(sql()).not.toContain("security definer");
  });

  it("트리거는 담당자 칸이 SET 에 있을 때만 돈다", () => {
    expect(sql()).toContain(
      "create trigger incidents_guard_assignee before update of assignee_email, assignee_name on public.incidents for each row execute function public.incidents_guard_assignee()",
    );
  });

  it("트리거 함수 실행 권한을 회수한다", () => {
    expect(sql()).toContain(
      "revoke execute on function public.incidents_guard_assignee() from public, anon, authenticated",
    );
  });
});

describe("incidentUpdateSchema — 앱은 담당자를 보내지 않는다", () => {
  it("assignee_email·assignee_name 키가 없다(트리거와 짝)", () => {
    const keys = Object.keys(incidentUpdateSchema.shape);
    expect(keys).not.toContain("assignee_email");
    expect(keys).not.toContain("assignee_name");
  });

  it("입력에 담당자가 섞여 와도 버린다", () => {
    const r = incidentUpdateSchema.safeParse({
      assignee_email: "me@jinhakapply.com",
      assignee_name: "나",
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data).not.toHaveProperty("assignee_email");
    expect(r.success && r.data).not.toHaveProperty("assignee_name");
  });
});
