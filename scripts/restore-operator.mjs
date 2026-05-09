// 일회성 — operators 테이블의 특정 사용자를 active 복구
// 사용: TARGET_NAME=김지영 node scripts/restore-operator.mjs
//   또는 TARGET_EMAIL=kjy0926@jinhakapply.com node scripts/restore-operator.mjs
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

const filter = process.env.TARGET_EMAIL
  ? { col: "email", val: process.env.TARGET_EMAIL }
  : process.env.TARGET_NAME
    ? { col: "name", val: process.env.TARGET_NAME }
    : null;

if (!filter) {
  console.error("Set TARGET_EMAIL or TARGET_NAME");
  process.exit(1);
}

const { data, error } = await sb
  .from("operators")
  .update({ status: "active", deleted_reason: null, deleted_at: null })
  .eq(filter.col, filter.val)
  .select();

if (error) {
  console.error("update failed:", error.message);
  process.exit(1);
}

if (!data || data.length === 0) {
  console.error(`No operator found with ${filter.col}=${filter.val}`);
  process.exit(1);
}

for (const op of data) {
  console.log(
    `✓ Restored: ${op.name} (${op.email}) → status=${op.status}, deleted_reason=null`,
  );
}
