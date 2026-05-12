// e2e 셋업 / 운영 — operators 한 명의 시스템 권한을 admin/member/viewer로 변경
// 사용:
//   TARGET_EMAIL=ys1114@jinhakapply.com PERMISSION=admin node scripts/toggle-permission.mjs
//   TARGET_NAME=송영신 PERMISSION=member node scripts/toggle-permission.mjs
//   PERMISSION=member ALLOWED_MENUS=receivables,team node scripts/toggle-permission.mjs
//     → permission + allowed_menus 함께 설정 (비-admin이 특정 메뉴 접근 필요 시)
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

const permission = process.env.PERMISSION;

if (!filter) {
  console.error("Set TARGET_EMAIL or TARGET_NAME");
  process.exit(1);
}
if (!["admin", "member", "viewer"].includes(permission)) {
  console.error(
    `PERMISSION must be one of admin|member|viewer (got: ${permission})`,
  );
  process.exit(1);
}

const updates = { permission };
if (process.env.ALLOWED_MENUS !== undefined) {
  updates.allowed_menus = process.env.ALLOWED_MENUS
    ? process.env.ALLOWED_MENUS.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
}

const { data, error } = await sb
  .from("operators")
  .update(updates)
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
    `✓ ${op.name} (${op.email}) → permission=${op.permission}`,
  );
}
