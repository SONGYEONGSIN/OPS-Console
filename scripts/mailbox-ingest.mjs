// scripts/mailbox-ingest.mjs
//
// 메일함 ingest — 로컬 cron(launchd) 진입점. Vercel(서버리스)은 로컬 claude CLI 불가하여
// 수신→DB→초안 생성은 이 로컬 잡이 담당하고, 웹앱은 표시·승인·발송만 한다.
//
// 흐름:
//   1) Graph Application 토큰(client_credentials)으로 대상 운영자 수신함 조회
//   2) mailbox_messages upsert (onConflict graph_message_id — 멱등)
//   3) auto_draft_enabled=true 운영자의 미초안·미필터 메일을 claude -p로 회신 초안 생성
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
//   CLAUDE_BIN(기본 claude), MAILBOX_LLM_MODEL(model_used 라벨, 기본 claude)

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import os from "node:os";

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
// 초안 생성 = 로컬 claude CLI(-p). team-briefing/dev-control과 동일한 안전 호출.
const CLAUDE_BIN =
  env.CLAUDE_BIN || (process.platform === "win32" ? "claude.cmd" : "claude");
const LLM_MODEL = env.MAILBOX_LLM_MODEL ?? "claude"; // model_used 라벨 · 이력 표기용

// Graph GET + 429(ApplicationThrottled) 백오프 재시도.
// Microsoft Graph는 메일박스당 동시 요청 ~4개로 제한하므로 429가 잦다.
// Retry-After 헤더(초) 우선, 없으면 기본 2초. 최대 3회 재시도.
export async function graphGetWithRetry(url, token, maxRetries = 3, extraHeaders = {}) {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, ...extraHeaders },
    });
    if (res.status !== 429) return res;
    if (attempt >= maxRetries) return res; // 호출부에서 !res.ok 처리(throw/skip)
    const retryAfter = Number(res.headers.get("Retry-After"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 2000;
    await new Promise((r) => setTimeout(r, waitMs));
    attempt++;
  }
}

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
    `&$select=id,subject,bodyPreview,body,from,receivedDateTime,isRead,internetMessageHeaders` +
    filterSuffix;
  // Prefer: text → 본문을 HTML 대신 plain text로 받는다 (인스펙터 태그 노출 방지).
  const res = await graphGetWithRetry(url, token, 3, {
    Prefer: 'outlook.body-content-type="text"',
  });
  if (!res.ok) throw new Error(`inbox ${res.status} ${await res.text()}`);
  return (await res.json()).value ?? [];
}

// 특정 폴더의 메시지 조회 (fetchInbox의 폴더별 일반화). 인코딩 방식 동일.
export async function fetchFolderMessages(token, ownerEmail, folderId, since) {
  const filterSuffix = since
    ? `&$filter=receivedDateTime%20gt%20${encodeURIComponent(since)}`
    : "";
  const url =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(ownerEmail)}` +
    `/mailFolders/${folderId}/messages` +
    `?$top=50` +
    `&$orderby=receivedDateTime%20desc` +
    `&$select=id,subject,bodyPreview,body,from,receivedDateTime,isRead,internetMessageHeaders` +
    filterSuffix;
  // Prefer: text → 본문을 HTML 대신 plain text로 받는다 (인스펙터 태그 노출 방지).
  const res = await graphGetWithRetry(url, token, 3, {
    Prefer: 'outlook.body-content-type="text"',
  });
  if (!res.ok)
    throw new Error(`folder ${folderId} ${res.status} ${await res.text()}`);
  return (await res.json()).value ?? [];
}

// 받은편지함의 직속 폴더 id를 조회한 뒤 childFolders를 재귀로 모두 모아
// 폴더 id 배열(받은편지함 자신 포함)을 반환. nextLink 페이지네이션 처리.
export async function collectInboxFolderIds(token, ownerEmail) {
  const userPath = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(ownerEmail)}`;

  // 1) 받은편지함 자신의 id 확보
  const inboxRes = await graphGetWithRetry(`${userPath}/mailFolders/inbox`, token);
  if (!inboxRes.ok)
    throw new Error(`inbox folder ${inboxRes.status} ${await inboxRes.text()}`);
  const inbox = await inboxRes.json();
  const rootId = inbox.id;

  const ids = [rootId];
  const seen = new Set([rootId]);

  // 2) BFS로 childFolders 재귀 수집 — 메일박스당 동시성 한도(4) 회피 위해 한 번에 하나씩 await.
  const queue = [rootId];
  while (queue.length > 0) {
    const parentId = queue.shift();
    let next =
      `${userPath}/mailFolders/${parentId}/childFolders` +
      `?$top=100&$select=id,displayName`;
    while (next) {
      const res = await graphGetWithRetry(next, token);
      if (!res.ok)
        throw new Error(
          `childFolders ${parentId} ${res.status} ${await res.text()}`,
        );
      const json = await res.json();
      for (const f of json.value ?? []) {
        if (f.id && !seen.has(f.id)) {
          seen.add(f.id);
          ids.push(f.id);
          queue.push(f.id);
        }
      }
      next = json["@odata.nextLink"] ?? null;
    }
  }

  return ids;
}

// 사내 도메인 — 이 메일함은 외부 고객(대학 담당자) 회신 초안 전용이므로
// 사내(@jinhak.com/@jinhakapply.com) 발신은 수집·초안 대상에서 제외(skip)한다.
const INTERNAL_DOMAINS = [/@jinhakapply\.com$/i, /@jinhak\.com$/i];

// bulk/뉴스레터/자동발송 판정 패턴. info@는 과차단 위험으로 의도적 제외.
const SKIP_PATTERNS = [
  /no-?reply/i,
  /mailer-daemon/i,
  /postmaster/i,
  /newsletter/i,
  // bulk 발신 도메인
  /stibee\.com/i,
  /maily\.so/i,
  /mailchimp/i,
  /sendgrid/i,
  /mailgun/i,
  /amazonses/i,
  /sendpulse/i,
  /mktomail/i,
  /cmail/i,
  /hubspotemail/i,
  /rmail/i,
  // bulk 서브도메인/접두
  /@news\./i,
  /@newsletter\./i,
  /@mail\./i,
  /promotion/i,
  /noti/i,
  // 자동발송 토큰
  /bounce/i,
  /notifications?/i,
  /donotreply/i,
  /do-not-reply/i,
  /auto/i,
  /marketing/i,
  /promo/i,
];

export function isAutoSender(fromEmail) {
  if (!fromEmail) return true;
  const addr = fromEmail.toLowerCase();
  return SKIP_PATTERNS.some((re) => re.test(addr));
}

// 사내 발신 판정 — 외부 고객 전용 메일함이므로 사내 도메인은 skip 대상.
export function isInternalSender(fromEmail) {
  if (!fromEmail) return false;
  const addr = fromEmail.toLowerCase();
  return INTERNAL_DOMAINS.some((re) => re.test(addr));
}

// 제목 기반 광고 판정 — (AD)/[AD]/(광고)/[광고] 표기. 정상 단어(Admission 등) 오판 방지.
const AD_SUBJECT_PATTERNS = [/[([]\s*ad\s*[)\]]/i, /[([]\s*광고\s*[)\]]/];
export function isAdSubject(subject) {
  if (!subject) return false;
  return AD_SUBJECT_PATTERNS.some((re) => re.test(subject));
}

// 제목 기반 시스템/결재 알림 판정 — 전자결재·승인·반려 워크플로 알림(외부 시스템 포함)은 회신 대상 아님.
const SYSTEM_SUBJECT_PATTERNS = [
  "전자결재",
  "결재요청",
  "결재완료",
  "결재-완료",
  "결재-결재요청",
  "결재-회수",
  "승인요청",
  "승인완료",
  "반려",
];
export function isSystemSubject(subject) {
  if (!subject) return false;
  return SYSTEM_SUBJECT_PATTERNS.some((kw) => subject.includes(kw));
}

// 대량발송/캠페인 헤더 마커 — 1:1 사람 메일엔 없고 ESP/캠페인 발송에만 붙는다.
// 발신주소·제목이 정상처럼 보이는 회사 대량메일(CJ eMsSMTP, Tesla SendGrid 등)을
// 도메인 blocklist 없이 잡기 위한 시그널. name 존재만으로 bulk로 보는 헤더 목록.
const BULK_HEADER_NAMES = new Set([
  "list-unsubscribe", // 뉴스레터 표준(RFC 2369)
  "list-id",
  "feedback-id", // 범용 ESP FBL
  "x-sg-eid", // SendGrid (Tesla 등)
  "x-sg-id",
  "x-mail_id", // 한국 TMS/eMsSMTP 캠페인 (CJ 등)
  "x-send_type",
  "x-list_table",
  "x-member_id",
  "x-csa-complaints",
  "x-mailgun-sid", // Mailgun
  "x-ses-outgoing", // Amazon SES
]);
// X-Mailer 값이 대량발송 솔루션이면 bulk (일반 Outlook/Apple Mail 값은 통과).
const BULK_MAILER_VALUE =
  /emssmtp|mailchimp|sendgrid|amazonses|sendpulse|mailgun|stibee|postmark/i;

// 헤더 배열(Graph internetMessageHeaders: {name,value}[])에서 대량발송 시그널을 찾는다.
export function hasBulkHeader(headers) {
  if (!Array.isArray(headers)) return false;
  return headers.some((h) => {
    const name = (h?.name ?? "").toLowerCase();
    const value = String(h?.value ?? "");
    if (BULK_HEADER_NAMES.has(name)) return true;
    if (name === "precedence" && /\b(bulk|list|junk)\b/i.test(value)) return true;
    if (name === "x-mailer" && BULK_MAILER_VALUE.test(value)) return true;
    return false;
  });
}

// 통합 skip 판정 — 사내 발신·광고·시스템 알림·자동발송·대량발송 헤더면 수집/초안 모두 제외.
export function shouldSkipMessage({ fromEmail, subject, headers }) {
  return (
    isAutoSender(fromEmail) ||
    isAdSubject(subject) ||
    isInternalSender(fromEmail) ||
    isSystemSubject(subject) ||
    hasBulkHeader(headers)
  );
}

// 초안을 고정 틀로 조립한다. AI는 본문 내용(bodyContent)만 생성하고,
// 인사·자기소개·맺음은 코드가 고정 조립한다. 서명은 초안에 붙이지 않는다 —
// 서명은 웹 발송 시점에 HTML로 첨부하므로 ingest 초안에는 서명을 넣지 않는다(중복 방지).
//   안녕하세요.
//   진학어플라이 {operatorName}입니다.   (operatorName 없으면 "진학어플라이입니다.")
//
//   {bodyContent.trim()}
//
//   감사합니다.
export function assembleDraft(operatorName, bodyContent) {
  const hasName = operatorName != null && operatorName.trim() !== "";
  const intro = hasName
    ? `안녕하세요.\n진학어플라이 ${operatorName.trim()}입니다.`
    : "안녕하세요.\n진학어플라이입니다.";
  return `${intro}\n\n${bodyContent.trim()}\n\n감사합니다.`;
}

// 문장 경계(마침표·물음표·느낌표 + 공백)마다 줄바꿈. 소수점(6.22)·약어는 공백이
// 없어 영향 없고, 기존 줄바꿈(\n)도 보존(공백/탭만 매칭).
export function splitSentences(text) {
  if (!text) return text;
  return text.replace(/([.!?])[ \t]+/g, "$1\n").trim();
}

// 회신 초안 LLM 프롬프트를 조립한다(순수 함수 — 테스트 가능).
// 핵심: 안내/공지(FYI)성 메일은 답할 용건이 없으므로 원문을 복창·요약하면
// 발신자에게 같은 내용을 되돌려주는 어색한 회신이 된다. 이 경우 내용을 한 줄로
// 짧게 짚고 "확인했다"는 수신 확인 위주로 작성하도록 분기 지시한다.
export function buildDraftPrompt(message) {
  return [
    "당신은 대학 입학 원서접수 운영부의 담당자입니다.",
    "아래 받은 메일에 대한 회신의 '본문 내용'만 작성하세요.",
    "인사말('안녕하세요' 등)·자기소개·맺음말('감사합니다' 등)·서명·이름은 절대 쓰지 마세요. 핵심 용건에 대한 답변만 작성합니다.",
    "최대한 간결하게(2~4문장) 한국어 비즈니스 정중체로 작성하세요. 대괄호 [] 는 어떤 경우에도 쓰지 마세요.",
    "메일에 질문·요청이 있으면 그 용건에만 답하세요.",
    "메일이 질문·요청 없는 안내/공지(FYI)성이면, 원문 내용을 길게 복창하거나 요약하지 마세요. 안내 내용을 한 줄로만 짧게 짚고 '확인하였습니다'처럼 수신 확인 위주로 작성하세요.",
    "금액·날짜 등 모르는 정보는 지어내지 말고 '확인 후 안내드리겠습니다'처럼 처리하며, 처리 완료·발급 완료 등 확정되지 않은 결과를 단정하지 마세요.",
    "마크다운(**, ##, - 목록)을 쓰지 마세요.",
    "",
    `[제목] ${message.subject ?? ""}`,
    `[본문] ${(message.bodyPreview ?? message.body ?? "").slice(0, 2000)}`,
  ].join("\n");
}

// claude -p로 회신 본문을 생성한다. dev-control/team-briefing과 동일 안전장치:
// 도구 전면 차단(Bash/Edit/Write/NotebookEdit/Task) + repo 밖 cwd(프로젝트 .claude 설정 상속 방지).
// 프롬프트는 stdin으로 전달. 실패 시 throw → 호출부가 해당 메일만 skip하고 잡은 계속.
function generateDraft(message, operatorName) {
  const prompt = buildDraftPrompt(message);
  const out = execFileSync(
    CLAUDE_BIN,
    ["-p", "--disallowedTools", "Bash Edit Write NotebookEdit Task"],
    {
      input: prompt,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120_000,
      shell: process.platform === "win32",
      cwd: os.tmpdir(),
    },
  );
  const rawBody = out.trim();
  return assembleDraft(operatorName, splitSentences(rawBody));
}

// automation_runs 이력 메시지 — 자동화 메뉴에서 "수집/초안 몇 건, 모델 무엇"을 보여준다. (순수)
export function buildIngestRunMessage(ingested, drafted, model) {
  return `수집 ${ingested}건 · 초안 ${drafted}건 생성 · 모델 ${model}`;
}

async function main() {
  const startedMs = Date.now();
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
    // 최초(last_synced_at null) 운영자는 과거 메일 폭주 방지를 위해 최근 24h만 처리
    const since =
      s.last_synced_at ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 운영자 행 — 초안 자기소개("진학어플라이 OOO입니다.")에만 사용.
    // 메시지 루프 밖에서 1회 조회해 재사용. 서명은 ingest 초안에 붙이지 않으므로 name만 조회.
    const { data: op } = await supabase
      .from("operators")
      .select("name")
      .eq("email", s.owner_email)
      .maybeSingle();
    const operatorName = op?.name ?? null;

    // 받은편지함 + 모든 하위 폴더 재귀 수집. graph_message_id unique라 폴더 중복 안전.
    const folderIds = await collectInboxFolderIds(token, s.owner_email);

    // 폴더별 메시지는 순차 fetch — 메일박스당 동시 요청 한도(~4) 초과 시
    // 429 ApplicationThrottled로 잡이 죽으므로 한 번에 하나씩 처리한다.
    // graphGetWithRetry로 3회 재시도 후에도 429면 그 폴더만 건너뛰고 잡은 계속.
    const inbox = [];
    for (const fid of folderIds) {
      try {
        const msgs = await fetchFolderMessages(token, s.owner_email, fid, since);
        inbox.push(...msgs);
      } catch (e) {
        if (/\b429\b/.test(e.message)) {
          console.warn(`folder skip (429 throttled): ${s.owner_email} ${fid}`);
          continue;
        }
        throw e;
      }
    }

    for (const m of inbox) {
      const fromEmail = m.from?.emailAddress?.address ?? null;
      // 사내·광고·시스템·자동발송·대량발송 메일은 수집 자체에서 제외 — upsert도 초안도 하지 않는다.
      if (
        shouldSkipMessage({
          fromEmail,
          subject: m.subject,
          headers: m.internetMessageHeaders,
        })
      )
        continue;

      const rowData = {
        owner_email: s.owner_email,
        graph_message_id: m.id,
        from_name: m.from?.emailAddress?.name ?? null,
        from_email: fromEmail,
        subject: m.subject ?? null,
        body_preview: m.bodyPreview ?? null,
        body: m.body?.content ?? null,
        received_at: m.receivedDateTime ?? null,
        is_read: m.isRead ?? false,
      };

      if (DRY_RUN) {
        console.log(
          `[dry] ${s.owner_email} ← ${rowData.from_email} | ${rowData.subject}`,
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

      // 초안 생성 조건: auto ON + 기존 draft 없음 (skip 메일은 위에서 이미 continue됨)
      if (!s.auto_draft_enabled) continue;
      const { count } = await supabase
        .from("mailbox_drafts")
        .select("id", { count: "exact", head: true })
        .eq("message_id", up.id);
      if ((count ?? 0) > 0) continue;

      try {
        const draftBody = await generateDraft(m, operatorName);
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

  // 자동화 메뉴 관측용 — 로컬 전용 잡(mailbox-ingest) 실행 1건을 automation_runs에 적재.
  // best-effort: 적재 실패가 잡 결과를 깨지 않도록 삼킨다. dry-run은 기록하지 않는다.
  if (!DRY_RUN) {
    try {
      await supabase.from("automation_runs").insert({
        job_id: "mailbox-ingest",
        ok: true,
        skipped: false,
        message: buildIngestRunMessage(ingested, drafted, LLM_MODEL),
        duration_ms: Date.now() - startedMs,
      });
    } catch (e) {
      console.error("automation_runs 적재 실패:", e.message);
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(async (e) => {
    console.error(e);
    // 실패도 자동화 메뉴에서 보이도록 best-effort 기록 (env/DB 불가 시 조용히 무시).
    if (!DRY_RUN) {
      try {
        const sb = createClient(
          env.NEXT_PUBLIC_SUPABASE_URL,
          env.SUPABASE_SERVICE_ROLE_KEY,
          { auth: { autoRefreshToken: false, persistSession: false } },
        );
        await sb.from("automation_runs").insert({
          job_id: "mailbox-ingest",
          ok: false,
          skipped: false,
          message: `실패: ${e instanceof Error ? e.message : String(e)}`.slice(
            0,
            1000,
          ),
          duration_ms: null,
        });
      } catch {
        // 기록 실패는 무시
      }
    }
    process.exit(1);
  });
}
