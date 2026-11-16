// 20261116_ops_weekly.sql 적용 검증 — 마이그레이션을 적용한 뒤에 실행한다.
// 사용: node scripts/ops-weekly-verify.mjs
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = readFileSync(".env.local", "utf8")
  .split("\n")
  .filter((l) => l && !l.startsWith("#"))
  .reduce((acc, l) => {
    const [k, ...v] = l.split("=");
    if (k) acc[k.trim()] = v.join("=").trim();
    return acc;
  }, {});

const opts = { auth: { autoRefreshToken: false, persistSession: false } };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, opts);
const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts);

// src/features/ops-weekly/constants.ts 의 SEED_PROJECT_NAMES 와 같아야 한다(계약 테스트가 SQL 과 대조).
const SEED_PROJECT_NAMES = [
  "PIMS",
  "접수관리자",
  "내부관리자",
  "경쟁률",
  "생성툴",
  "매출 분석",
  "정산 · 진학캐쉬",
  "초중고",
  "인증",
  "대교협 연계",
  "추천인 검증",
  "보증보험",
  "실적증명",
  "계약서",
  "유의사항",
];

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

const results = [];
const check = (ok, label, detail = "") => results.push({ ok, label, detail });

// 없는 테이블도 error:null 로 조용히 0건이 나올 수 있다 — 판별자는 count !== null.
const counts = {};
for (const t of TABLES) {
  const { count, error } = await admin
    .from(t)
    .select("*", { count: "exact", head: true });
  counts[t] = count;
  check(count !== null, `테이블 ${t}`, error ? error.message : `count=${count}`);
}

check(
  counts.ops_weekly_settings === 1,
  "ops_weekly_settings 단일 행",
  `count=${counts.ops_weekly_settings}`,
);

const { data: projects, error: projErr } = await admin
  .from("ops_weekly_projects")
  .select("name");
const names = new Set((projects ?? []).map((p) => p.name));
const seedOk =
  !projErr &&
  names.size === SEED_PROJECT_NAMES.length &&
  SEED_PROJECT_NAMES.every((n) => names.has(n));
check(
  seedOk,
  "프로젝트 시드 15개 일치",
  projErr ? projErr.message : `names=${names.size}`,
);

const { data: bucket, error: bucketErr } =
  await admin.storage.getBucket("ops-weekly");
check(
  !bucketErr && bucket?.public === false,
  "버킷 ops-weekly 비공개(public=false)",
  bucketErr ? bucketErr.message : `public=${bucket?.public}`,
);

// anon 은 쓰기·열람·함수 실행 모두 막혀야 한다.
// 순번 교체 함수는 service_role 로 부르지 않는다(순번표를 실제로 갈아엎는다) — anon 거절로 대신 본다.
const ins = await anon.from("ops_weekly_weeks").insert({
  week_start: "2026-01-05",
  label_year: 2026,
  label_month: 1,
  label_week: 1,
});
check(
  !!ins.error,
  "anon insert ops_weekly_weeks 거절",
  ins.error ? `code=${ins.error.code} ${ins.error.message}` : "에러 없음",
);

const rec = await anon.from("ops_weekly_recipients").select("email");
check(
  (rec.data ?? []).length === 0,
  "anon select ops_weekly_recipients 0행",
  rec.error ? `code=${rec.error.code} ${rec.error.message}` : `rows=${(rec.data ?? []).length}`,
);

// 권한 거부(42501)만 통과다 — 함수가 아예 없어도(PGRST202) 에러는 나므로 '에러가 있다'로 보면 누락이 초록이 된다.
const rpc = await anon.rpc("ops_weekly_replace_rotation", { emails: [] });
check(
  rpc.error?.code === "42501",
  "anon rpc ops_weekly_replace_rotation 권한 거부(42501)",
  rpc.error ? `code=${rpc.error.code} ${rpc.error.message}` : "에러 없음",
);

console.log("ops-weekly 마이그레이션 검증:");
for (const r of results) {
  console.log(`  ${r.ok ? "✓" : "✗"} ${r.label}${r.detail ? ` — ${r.detail}` : ""}`);
}
process.exit(results.every((r) => r.ok) ? 0 : 1);
