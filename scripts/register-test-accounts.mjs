// 일회성 — 백업요청 테스트용 임시 계정 등록 (auth 유저 + operators row).
// 사용: node scripts/register-test-accounts.mjs
//
// 멱등(idempotent): 이미 있으면 비밀번호/메타만 갱신. operators row는 upsert.
// 정리: node scripts/delete-user.mjs (이메일 지정) + src/features/auth/operators.ts TEST_OPERATORS 비우기.
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

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const PASSWORD = "Test1234!";

// operators.ts TEST_OPERATORS와 일치
const ACCOUNTS = [
  {
    email: "ysong2526@gmail.com",
    name: "테스트1",
    team: "운영2팀",
    role: "매니저",
    emp_no: "TEST001",
    hired_at: "2026-05-29",
    birth_date: "1990-01-01",
    gender: "남",
  },
  {
    email: "yss040607@gmail.com",
    name: "테스트2",
    team: "운영2팀",
    role: "매니저",
    emp_no: "TEST002",
    hired_at: "2026-05-29",
    birth_date: "1990-01-01",
    gender: "남",
  },
];

async function findUserByEmail(email) {
  // listUsers 페이지네이션 — 테스트 계정 수가 적어 1페이지로 충분하나 안전하게 순회.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit;
    if (data.users.length < 1000) break;
  }
  return null;
}

async function ensureAuthUser(email) {
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (!error) {
    console.log(`  ✓ auth 유저 생성: ${email} (id=${data.user.id})`);
    return data.user.id;
  }
  // 이미 존재 → 비밀번호 + email_confirm 갱신
  const existing = await findUserByEmail(email);
  if (!existing) {
    throw new Error(`createUser 실패 & 조회 실패: ${error.message}`);
  }
  const { error: upErr } = await sb.auth.admin.updateUserById(existing.id, {
    password: PASSWORD,
    email_confirm: true,
  });
  if (upErr) throw upErr;
  console.log(`  ✓ auth 유저 존재 → 비밀번호 갱신: ${email} (id=${existing.id})`);
  return existing.id;
}

async function upsertOperator(acc) {
  const row = {
    email: acc.email,
    name: acc.name,
    team: acc.team,
    role: acc.role,
    emp_no: acc.emp_no,
    hired_at: acc.hired_at,
    birth_date: acc.birth_date,
    gender: acc.gender,
    status: "active",
    permission: "admin",
    allowed_menus: [], // admin은 bypass
  };
  const { error } = await sb
    .from("operators")
    .upsert(row, { onConflict: "email" });
  if (error) throw error;
  console.log(`  ✓ operators row upsert: ${acc.email} (${acc.name}, ${acc.team}, admin)`);
}

for (const acc of ACCOUNTS) {
  console.log(`\n[${acc.email}]`);
  await ensureAuthUser(acc.email);
  await upsertOperator(acc);
}

console.log(`\n완료. 비밀번호: ${PASSWORD}`);
