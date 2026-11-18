import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AREAS,
  OPS_WEEKLY_BUCKET,
  PROJECT_STAGES,
  SEED_PROJECT_NAMES,
} from "../constants";
import { DEV_STAGES } from "../dev-status";

// 주석을 먼저 지운다 — 정의를 주석 처리하고도 초록이면 대조가 아니다.
function migration(file: string): string {
  return readFileSync(join(process.cwd(), "supabase/migrations", file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ");
}

const sql = migration("20261116_ops_weekly.sql");

// 칸 단언은 해당 테이블 정의 안에서만 본다.
function body(table: string): string {
  return (
    new RegExp(
      `create table if not exists public\\.${table} \\(([\\s\\S]*?)\\);`,
    ).exec(sql)?.[1] ?? ""
  );
}

// `create or replace function public.<name>(` ~ 다음 `$$;` 까지
function fnBody(name: string): string {
  return (
    new RegExp(
      `create or replace function public\\.${name}\\(([\\s\\S]*?)\\$\\$;`,
    ).exec(sql)?.[1] ?? ""
  );
}

const TABLES = [
  "ops_weekly_weeks",
  "ops_weekly_reports",
  "ops_weekly_area_notes",
  "ops_weekly_item_overrides",
  "ops_weekly_manual_items",
  "ops_weekly_projects",
  "ops_weekly_project_owners",
  "ops_weekly_project_entries",
  "ops_weekly_duty_rotation",
  "ops_weekly_settings",
  "ops_weekly_recipients",
  "ops_weekly_dev_status",
];

describe("ops_weekly 마이그레이션", () => {
  it("테이블 12개 + RLS enable + 기본 권한 회수", () => {
    for (const t of TABLES) {
      expect(sql).toContain(`create table if not exists public.${t} (`);
      expect(sql).toContain(
        `alter table public.${t} enable row level security`,
      );
      expect(sql).toMatch(
        new RegExp(
          `revoke all on public\\.${t}\\s+from public, anon, authenticated`,
        ),
      );
      expect(sql).toMatch(
        new RegExp(`grant all on public\\.${t}\\s+to service_role`),
      );
    }
  });

  it("테이블 목록은 마이그레이션에서 센다 — 12라는 숫자를 믿지 않는다", () => {
    const created = sql.match(
      /create table if not exists public\.ops_weekly_\w+ \(/g,
    );
    expect(created).toHaveLength(TABLES.length);
    expect(TABLES).toHaveLength(12);
  });

  it("authenticated 는 테이블마다 select 권한과 열람 정책 하나뿐이다", () => {
    for (const t of TABLES) {
      expect(sql).toContain(`grant select on public.${t} to authenticated;`);
      expect(sql).toContain(
        `create policy "${t}_select" on public.${t} for select to authenticated using (`,
      );
    }
    const grants = [
      ...sql.matchAll(
        /grant ([a-z, ]+?) on public\.ops_weekly_\w+ to authenticated/g,
      ),
    ].map((m) => m[1]);
    expect(grants).toHaveLength(TABLES.length);
    expect(new Set(grants)).toEqual(new Set(["select"]));
  });

  it("쓰기 정책은 없다 — public 테이블 정책은 전부 for select", () => {
    const kinds = [
      ...sql.matchAll(
        /create policy "[^"]+" on public\.ops_weekly_\w+ for (\w+)/g,
      ),
    ].map((m) => m[1]);
    expect(kinds).toHaveLength(TABLES.length);
    expect(new Set(kinds)).toEqual(new Set(["select"]));
    expect(sql).not.toMatch(
      /for (insert|update|delete|all) to (authenticated|anon|public)/,
    );
  });

  it("버킷 객체 정책은 service_role 전용 하나", () => {
    expect(sql).toContain(
      `create policy "ops_weekly_objects_service_only" on storage.objects for all to service_role using (bucket_id = '${OPS_WEEKLY_BUCKET}') with check (bucket_id = '${OPS_WEEKLY_BUCKET}')`,
    );
    expect(
      sql.match(/create policy "[^"]+" on storage\.objects/g),
    ).toHaveLength(1);
  });

  it("진행 단계 check 가 PROJECT_STAGES 와 같은 순서", () => {
    const list = PROJECT_STAGES.map((s) => `'${s}'`).join(",");
    expect(body("ops_weekly_project_entries")).toContain(
      `stage text check (stage in (${list}))`,
    );
  });

  it("영역 check 가 AREAS 와 같다", () => {
    expect(body("ops_weekly_area_notes")).toContain(
      `area text not null check (area in (${AREAS.map((a) => `'${a}'`).join(",")}))`,
    );
  });

  it("주 시작은 월요일, 주당 운영자 보고서는 하나", () => {
    expect(body("ops_weekly_weeks")).toContain(
      "week_start date not null unique check (extract(isodow from week_start) = 1)",
    );
    expect(body("ops_weekly_reports")).toContain(
      "unique (week_id, operator_email)",
    );
  });

  it("settings·recipients 만 admin 열람이고 is_admin 은 감싼다", () => {
    expect(sql).toMatch(
      /on public\.ops_weekly_settings for select to authenticated using \(\(select public\.is_admin\(\)\)\)/,
    );
    expect(sql).toMatch(
      /on public\.ops_weekly_recipients for select to authenticated using \(\(select public\.is_admin\(\)\)\)/,
    );
    expect(sql).not.toMatch(/using \(public\.is_admin\(\)\)/);
  });

  it("프로젝트 시드 = SEED_PROJECT_NAMES 15개", () => {
    for (const n of SEED_PROJECT_NAMES) expect(sql).toContain(`('${n}'`);
    expect(SEED_PROJECT_NAMES).toHaveLength(15);
  });

  it("비공개 버킷 + settings 단일 행 + 스키마 캐시 갱신", () => {
    expect(sql).toContain(
      `insert into storage.buckets (id, name, public) values ('${OPS_WEEKLY_BUCKET}', '${OPS_WEEKLY_BUCKET}', false)`,
    );
    expect(sql).toContain(
      "insert into public.ops_weekly_settings (id) values (true) on conflict (id) do nothing",
    );
    expect(sql).toContain("notify pgrst, 'reload schema'");
  });

  it("순번 교체 함수 — 전체 삭제는 where true, 실행은 service_role 만", () => {
    const fn = fnBody("ops_weekly_replace_rotation");
    expect(sql).toContain(
      "create or replace function public.ops_weekly_replace_rotation(emails text[])",
    );
    expect(fn).toContain(
      "delete from public.ops_weekly_duty_rotation where true",
    );
    expect(fn).toContain(
      "insert into public.ops_weekly_duty_rotation (position, operator_email)",
    );
    expect(fn).toContain("with ordinality");
    expect(fn).not.toMatch(/security definer/);
    expect(sql).toMatch(
      /revoke execute on function public\.ops_weekly_replace_rotation\(text\[\]\)\s+from public, anon, authenticated/,
    );
    expect(sql).toMatch(
      /grant\s+execute on function public\.ops_weekly_replace_rotation\(text\[\]\)\s+to service_role/,
    );
  });
});

describe("ops_weekly_dev_status 구분 check — deployed 추가", () => {
  const deployed = migration("20261118_ops_weekly_dev_status_deployed.sql");
  // 원본은 이름 없는 칸 check 라 Postgres 기본 이름(<표>_<칸>_check)을 받았다.
  const NAME = "ops_weekly_dev_status_stage_check";

  it("원본 check 는 이름 없는 칸 check 다 — 그래서 기본 이름을 지운다", () => {
    expect(body("ops_weekly_dev_status")).toContain(
      "stage text not null check (stage in ('dev','test'))",
    );
  });

  it("drop if exists 뒤에 같은 이름으로 DEV_STAGES 를 다시 건다", () => {
    const list = DEV_STAGES.map((s) => `'${s}'`).join(",");
    const drop = `alter table public.ops_weekly_dev_status drop constraint if exists ${NAME};`;
    const add = `alter table public.ops_weekly_dev_status add constraint ${NAME} check (stage in (${list}));`;
    expect(deployed).toContain(drop);
    expect(deployed).toContain(add);
    expect(deployed.indexOf(drop)).toBeLessThan(deployed.indexOf(add));
    expect(list).toBe("'dev','test','deployed'");
  });

  it("check 만 바꾼다 — 칸을 더하지 않는다", () => {
    expect(deployed).not.toMatch(/add column/i);
    expect(deployed.match(/alter table/g)).toHaveLength(2);
  });
});
