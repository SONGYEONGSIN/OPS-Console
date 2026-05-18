#!/usr/bin/env node
// services.application_type 값 distinct 조사 — 시트의 구분 매칭 전략 결정용
import { config as dotenvConfig } from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenvConfig({ path: ".env.local" });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const TARGETS = [
  "한국예술종합학교",
  "명지대학교",
];

for (const uni of TARGETS) {
  const { data, error } = await supabase
    .from("services")
    .select("service_id, university_name, service_name, application_type, operator_name")
    .eq("university_name", uni);
  if (error) {
    console.error(uni, error.message);
    continue;
  }
  console.log(`\n== ${uni} (${data?.length ?? 0}건) ==`);
  for (const r of data ?? []) {
    console.log(`  ${r.service_id}: [${r.application_type}] ${r.service_name} (op:${r.operator_name})`);
  }
}
