// 원서GEN 로그인 → A/AU.js 수집 → 변경분만 claude -p 분석 → Supabase 적재
// 실행: node scripts/dev-control-analyze.mjs [serviceId ...]  (미지정 시 전체 testable)
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { sha256, parseDevInfo, buildClaudePrompt, parseClaudeJson } from "./lib/dev-control-lib.mjs";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BASE = "https://generator.jinhakapply.com";
const GEN_FLAGS = ["WA", "WB", "WC", "WD"];

const jar = {};
const save = (r) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [p] = c.split(";"); const [k, v] = p.split("="); jar[k.trim()] = v; } };
const ck = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
const hidden = (h, n) => (h.match(new RegExp(`name="${n}"[^>]*value="([^"]*)"`)) ?? [])[1] ?? "";

async function login() {
  let r = await fetch(`${BASE}/Login.aspx`); save(r);
  const h = await r.text();
  r = await fetch(`${BASE}/Login.aspx`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: ck() },
    body: new URLSearchParams({
      __VIEWSTATE: hidden(h, "__VIEWSTATE"),
      __VIEWSTATEGENERATOR: hidden(h, "__VIEWSTATEGENERATOR"),
      __EVENTVALIDATION: hidden(h, "__EVENTVALIDATION"),
      AdminId: env.MOA_USERNAME, AdminPassWord: env.MOA_PASSWORD, LoginBtn: "",
    }).toString(),
  }); save(r);
  if (r.status !== 302 || !jar.Generator) { console.error("[dev-control] 로그인 실패 — 중단(계정 잠금 방지)"); process.exit(1); }
}

async function fetchDevInfo(serviceId, genFlag) {
  const r = await fetch(`${BASE}/_AU/Default.aspx/GetDevInfoByUnivServiceId`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", Cookie: ck() },
    body: JSON.stringify({ UnivServiceID: String(serviceId), GenFlag: genFlag }),
  });
  if (r.status !== 200) return null; // 존재하지 않는 GenFlag — 정상 skip
  return parseDevInfo(await r.text());
}

// Windows: execFileSync는 shell 없이 spawn하므로 확장자 없는 "claude" 셸 스크립트를
// 찾지 못해 ENOENT가 난다. PATHEXT 해석이 되는 "claude.cmd"로 호출하되, Node이
// CVE-2024-27980 대응으로 .cmd/.bat shim을 shell:true 없이 spawn하면 EINVAL을 던지므로
// shell:true가 필요하다. 단 shell:true + 긴 argv는 Windows 명령줄 길이 한도(약 32K자)에
// 걸려 ENAMETOOLONG이 나므로, 코드는 argv가 아니라 stdin으로 전달한다(claude -p는
// prompt 인자가 없으면 stdin을 읽는다).
const CLAUDE_BIN = process.platform === "win32" ? "claude.cmd" : "claude";

function analyze(kind, code) {
  // 안전장치: 이 subprocess는 이 리포 CWD에서 실행되며 프로젝트 .claude/settings.json의
  // 기존 허용 목록을 상속해 Bash/git 등을 승인 없이 실행할 수 있다 — 라이브 검증 중
  // 실제로 `git checkout`을 자체 판단으로 실행해 브랜치를 전환한 사례를 확인했다.
  // 이 호출은 순수 텍스트 분석(JSON 요약 생성)만 필요하므로 도구 사용을 전면 차단한다.
  const out = execFileSync(CLAUDE_BIN, ["-p", "--disallowedTools", "Bash Edit Write NotebookEdit Task"], {
    input: buildClaudePrompt(kind, code),
    encoding: "utf8", maxBuffer: 10 * 1024 * 1024, timeout: 300_000,
    shell: process.platform === "win32",
  });
  return parseClaudeJson(out);
}

const mergeFlags = (prev, next) => {
  const byKey = new Map((prev ?? []).map((p) => [p.key, p]));
  return next.map((n) => {
    const old = byKey.get(n.key);
    return { ...n, checked: old?.checked ?? false, note: old?.note ?? "" };
  });
};

const argIds = process.argv.slice(2).map(Number).filter(Boolean);
const { data: services, error } = await sb.from("services")
  .select("service_id").not("service_id", "is", null);
if (error) { console.error(error.message); process.exit(1); }
const ids = argIds.length ? argIds : [...new Set(services.map((s) => s.service_id))];

await login();
let analyzed = 0, skipped = 0, failed = 0;
for (const id of ids) {
  for (const genFlag of GEN_FLAGS) {
    const files = await fetchDevInfo(id, genFlag);
    if (!files) continue;
    for (const f of files) {
      const hash = sha256(f.content);
      const { data: prev } = await sb.from("dev_control_analyses")
        .select("id, code_hash, flags").eq("service_id", id)
        .eq("gen_flag", genFlag).eq("kind", f.kind).maybeSingle();
      if (prev?.code_hash === hash) { skipped++; continue; }
      let summary_md = null, flags = [];
      try {
        const res = analyze(f.kind, f.content);
        summary_md = res.summary_md;
        flags = mergeFlags(prev?.flags, res.flags);
      } catch (e) {
        failed++;
        console.error(`[dev-control] 분석 실패 ${id}/${genFlag}/${f.kind}: ${e.message} — raw만 저장`);
      }
      const { error: upErr } = await sb.from("dev_control_analyses").upsert({
        service_id: id, gen_flag: genFlag, kind: f.kind, code_hash: hash,
        raw_code: f.content, summary_md, flags, analyzed_at: new Date().toISOString(),
      }, { onConflict: "service_id,gen_flag,kind" });
      if (upErr) { failed++; console.error(`[dev-control] upsert 실패: ${upErr.message}`); }
      else analyzed++;
    }
  }
}
console.log(`[dev-control] 완료 — 분석 ${analyzed} / 스킵 ${skipped} / 실패 ${failed}`);
