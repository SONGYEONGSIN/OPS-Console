// 일회성 — Supabase admin API로 특정 이메일 사용자 삭제
// 사용: TARGET_EMAIL=ys1114@jinhakapply.com node scripts/delete-user.mjs
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

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const target = process.env.TARGET_EMAIL;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!target) {
  console.error("Missing TARGET_EMAIL env");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error: listErr } = await supabase.auth.admin.listUsers({
  page: 1,
  perPage: 1000,
});
if (listErr) {
  console.error("listUsers failed:", listErr.message);
  process.exit(1);
}

const match = data.users.find((u) => u.email === target);
if (!match) {
  console.error(`No user found with email: ${target}`);
  process.exit(1);
}

console.log(`Found: ${match.email} (id=${match.id})`);
console.log("Deleting...");

const { error: delErr } = await supabase.auth.admin.deleteUser(match.id);
if (delErr) {
  console.error("deleteUser failed:", delErr.message);
  process.exit(1);
}

console.log(`✓ Deleted ${match.email} (${match.id})`);
