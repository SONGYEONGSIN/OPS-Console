// scripts/mailbox-ingest.mjs
//
// 메일함 ingest — 로컬 cron(launchd) 진입점. Vercel(서버리스)은 로컬 LLM 불가하여
// 수신→DB→초안 생성은 이 로컬 잡이 담당하고, 웹앱은 표시·승인·발송만 한다.
//
// 흐름:
//   1) Graph Application 토큰(client_credentials)으로 대상 운영자 수신함 조회
//   2) mailbox_messages upsert (onConflict graph_message_id — 멱등)
//   3) auto_draft_enabled=true 운영자의 미초안·미필터 메일을 Ollama로 회신 초안 생성
//   4) mailbox_drafts insert
//
// 대상 운영자: mailbox_settings에 row 존재하는 운영자 (스펙 §13 — 메뉴 사용 운영자 한정).
//
// 사용:
//   node scripts/mailbox-ingest.mjs --dry-run     # Graph/DB read만, write·LLM 생략
//   node scripts/mailbox-ingest.mjs               # 실제 적재 + 초안 생성
//
// 필요 env(.env.local): AZURE_AD_TENANT_ID/CLIENT_ID/CLIENT_SECRET,
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   MAILBOX_LLM_MODEL(기본 exaone3.5:7.8b), OLLAMA_URL(기본 http://localhost:11434)

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

function loadEnv() {
  const fromFile = existsSync(".env.local")
    ? readFileSync(".env.local", "utf8")
        .split("\n")
        .filter((l) => l && !l.startsWith("#"))
        .reduce((acc, l) => {
          const [k, ...v] = l.split("=");
          if (k) acc[k.trim()] = v.join("=").trim();
          return acc;
        }, {})
    : {};
  return { ...fromFile, ...process.env };
}

const env = loadEnv();
const DRY_RUN = process.argv.slice(2).includes("--dry-run");
const OLLAMA_URL = env.OLLAMA_URL ?? "http://localhost:11434";
const LLM_MODEL = env.MAILBOX_LLM_MODEL ?? "exaone3.5:7.8b";

for (const k of [
  "AZURE_AD_TENANT_ID",
  "AZURE_AD_CLIENT_ID",
  "AZURE_AD_CLIENT_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  if (!env[k]) {
    console.error(`Missing required env: ${k}`);
    process.exit(1);
  }
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function getGraphToken() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.AZURE_AD_CLIENT_ID,
    client_secret: env.AZURE_AD_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  if (!res.ok) throw new Error(`graph auth ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

// 인코딩 기준: src/lib/microsoft/mail-read.ts getInboxMessages (server-only라 직접 import 불가, 동일 방식 유지)
// URLSearchParams는 OData 키 $를 %24로 인코딩하므로 사용하지 않는다.
// 키는 리터럴 $, 공백은 %20, 값은 encodeURIComponent로 직접 조합한다.
export async function fetchInbox(token, ownerEmail, since) {
  const filterSuffix = since
    ? `&$filter=receivedDateTime%20gt%20${encodeURIComponent(since)}`
    : "";
  const url =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(ownerEmail)}` +
    `/mailFolders/inbox/messages` +
    `?$top=50` +
    `&$orderby=receivedDateTime%20desc` +
    `&$select=id,subject,bodyPreview,body,from,receivedDateTime,isRead` +
    filterSuffix;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`inbox ${res.status} ${await res.text()}`);
  return (await res.json()).value ?? [];
}

const SKIP_PATTERNS = [/no-?reply/i, /mailer-daemon/i, /postmaster/i, /newsletter/i];
export function isAutoSender(fromEmail) {
  if (!fromEmail) return true;
  return SKIP_PATTERNS.some((re) => re.test(fromEmail));
}

async function generateDraft(message) {
  const prompt = [
    "당신은 대학 입학 원서접수 운영부의 담당자입니다.",
    "아래 받은 메일에 대한 회신 초안을 한국어 비즈니스 정중체로 작성하세요.",
    "인사 → 용건 확인 → 안내/조치 → 마무리 인사 순. 서명은 제외.",
    "",
    `[제목] ${message.subject ?? ""}`,
    `[본문] ${(message.bodyPreview ?? message.body ?? "").slice(0, 2000)}`,
  ].join("\n");

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: LLM_MODEL, prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status} ${await res.text()}`);
  return (await res.json()).response?.trim() ?? "";
}

async function main() {
  const token = await getGraphToken();

  // 대상 운영자 = mailbox_settings row 존재 (메뉴 사용 운영자 한정, 스펙 §13)
  const { data: settings, error: setErr } = await supabase
    .from("mailbox_settings")
    .select("owner_email, auto_draft_enabled, last_synced_at");
  if (setErr) throw new Error(`settings: ${setErr.message}`);
  if (!settings || settings.length === 0) {
    console.log("대상 메일함 없음 (mailbox_settings 비어있음).");
    return;
  }

  let ingested = 0;
  let drafted = 0;

  for (const s of settings) {
    const inbox = await fetchInbox(token, s.owner_email, s.last_synced_at);
    for (const m of inbox) {
      const skip = isAutoSender(m.from?.emailAddress?.address);
      const rowData = {
        owner_email: s.owner_email,
        graph_message_id: m.id,
        from_name: m.from?.emailAddress?.name ?? null,
        from_email: m.from?.emailAddress?.address ?? null,
        subject: m.subject ?? null,
        body_preview: m.bodyPreview ?? null,
        body: m.body?.content ?? null,
        received_at: m.receivedDateTime ?? null,
        is_read: m.isRead ?? false,
        draft_skipped: skip,
      };

      if (DRY_RUN) {
        console.log(
          `[dry] ${s.owner_email} ← ${rowData.from_email} | ${rowData.subject}${skip ? " (skip)" : ""}`,
        );
        continue;
      }

      const { data: up, error: upErr } = await supabase
        .from("mailbox_messages")
        .upsert(rowData, { onConflict: "graph_message_id", ignoreDuplicates: false })
        .select("id")
        .single();
      if (upErr) {
        console.error(`upsert fail: ${upErr.message}`);
        continue;
      }
      ingested++;

      // 초안 생성 조건: auto ON + 미필터 + 기존 draft 없음
      if (!s.auto_draft_enabled || skip) continue;
      const { count } = await supabase
        .from("mailbox_drafts")
        .select("id", { count: "exact", head: true })
        .eq("message_id", up.id);
      if ((count ?? 0) > 0) continue;

      try {
        const draftBody = await generateDraft(m);
        const { error: dErr } = await supabase.from("mailbox_drafts").insert({
          message_id: up.id,
          draft_body: draftBody,
          model_used: LLM_MODEL,
          status: "draft",
        });
        if (dErr) console.error(`draft insert fail: ${dErr.message}`);
        else drafted++;
      } catch (e) {
        console.error(`draft gen fail (${s.owner_email}):`, e.message);
      }
    }

    if (!DRY_RUN) {
      await supabase
        .from("mailbox_settings")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("owner_email", s.owner_email);
    }
  }

  console.log(`done — ingested=${ingested} drafted=${drafted} dryRun=${DRY_RUN}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
