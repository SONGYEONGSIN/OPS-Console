import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
// 후보 테이블에 select head 시도 — 존재하면 count, 없으면 error
const candidates = [
  "services", "contracts", "contacts", "backup_requests", "incidents",
  "handover_records", "todos", "ai_work", "insight_videos", "operators",
  "schedule_events", "posts", "onboarding_cohorts", "onboarding_progress",
  "alerts", "data_requests", "vault_items", "worklog", "reports",
  "pims", "projects", "ai_assistants", "ai_tips", "manuals", "sop",
  "meeting_notes", "vibe_coding_guides", "receivables", "deploys",
  "service_phases", "closings", "settlements", "invoices",
];
const head = { count: "exact", head: true };
const results = [];
for (const t of candidates) {
  const { count, error } = await s.from(t).select("*", head);
  results.push({ table: t, count: error ? null : count, err: error?.message });
}
for (const r of results) {
  console.log(`  ${r.count === null ? "✗" : "✓"} ${r.table}: ${r.count === null ? r.err?.slice(0, 60) : r.count}`);
}
