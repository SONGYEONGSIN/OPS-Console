import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AREAS,
  OPS_WEEKLY_BUCKET,
  PROJECT_STAGES,
  SEED_PROJECT_NAMES,
} from "../constants";

// 주석을 먼저 지운다 — 정의를 주석 처리하고도 초록이면 대조가 아니다.
const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261116_ops_weekly.sql"),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/--.*$/gm, "")
  .replace(/\s+/g, " ");

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
