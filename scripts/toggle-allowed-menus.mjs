// e2e 셋업 / 운영 — operators 한 명의 allowed_menus를 갱신
// 사용:
//   TARGET_EMAIL=ys1114@jinhakapply.com MENUS=alerts,feedback node scripts/toggle-allowed-menus.mjs
//   TARGET_EMAIL=... MENUS= node scripts/toggle-allowed-menus.mjs   # 빈 배열로 초기화
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

const raw = process.env.MENUS;
if (raw === undefined) {
  console.error("Set MENUS=slug1,slug2,... (or MENUS= for empty)");
  process.exit(1);
}

const menus = raw
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const { data, error } = await sb
  .from("operators")
  .update({ allowed_menus: menus })
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
    `✓ ${op.name} (${op.email}) → allowed_menus=[${op.allowed_menus.join(", ") || "empty"}]`,
  );
}
