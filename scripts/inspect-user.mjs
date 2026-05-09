// 일회성 — Supabase admin API로 사용자 상태 조회
// 사용: TARGET_EMAIL=user@example.com node scripts/inspect-user.mjs
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

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const target = process.env.TARGET_EMAIL;
const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (error) {
  console.error("listUsers failed:", error.message);
  process.exit(1);
}

const u = data.users.find((x) => x.email === target);
if (!u) {
  console.log(`No user found with email: ${target}`);
  process.exit(0);
}

console.log(JSON.stringify({
  id: u.id,
  email: u.email,
  email_confirmed_at: u.email_confirmed_at,
  confirmed_at: u.confirmed_at,
  last_sign_in_at: u.last_sign_in_at,
  created_at: u.created_at,
  app_metadata: u.app_metadata,
  identities: u.identities?.map((i) => ({ provider: i.provider, identity_id: i.identity_id, email: i.email })),
  banned_until: u.banned_until,
}, null, 2));
