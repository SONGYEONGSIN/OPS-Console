// 저장된 raw_code → claude -p 명세 생성 → dev_control_specs 적재
//
// 실행: node scripts/dev-control-spec.mjs <serviceId>
//
// **수집을 다시 하지 않는다** — 원서GEN 로그인도, Moa 접속도 없다. 분석이 이미
// 걷어 둔 raw_code 를 다른 프롬프트로 다시 읽는 것뿐이다. 그래서 분석보다 훨씬 빠르고,
// 계정 잠금 위험도 없다.
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  buildSpecPrompt,
  parseSpecJson,
  mergeFileItems,
  bySizeDesc,
} from "./lib/dev-control-lib.mjs";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);

const serviceId = Number(process.argv[2]);
if (!serviceId) {
  console.error("[spec] serviceId 필요 — node scripts/dev-control-spec.mjs <id>");
  process.exit(1);
}

const CLAUDE_BIN = process.platform === "win32" ? "claude.cmd" : "claude";

/**
 * 파일 하나에 주는 시간.
 *
 * 5분으로는 **가장 큰 파일(18,484자)이 두 번 다 죽었다** — 셋이 동시에 도는
 * 동안 서로 느려져 경계를 넘는다. 그 파일이 단독 60항목짜리라 빠지면 손실이 크다.
 */
const PER_FILE_TIMEOUT_MS = 600_000;

/**
 * 전체 예산의 **기본값**. 회사 PC 폴러 실행 제한(20분)보다 작아야 한다 — 크면
 * 작업 스케줄러가 먼저 잘라서 스크립트가 실패를 보고할 기회조차 없이 죽고,
 * 요청은 running 인 채 남아 화면이 영영 '진행 중'이다(2026-09-04 겪었다).
 */
const DEFAULT_BUDGET_MS = 900_000;

/**
 * 실제 예산. `SPEC_BUDGET_MS` 로 늘릴 수 있다.
 *
 * **자택 실행에는 작업 스케줄러 제한이 없다** — spec-poll.mjs 는 그냥 node
 * 프로세스라 예산을 키워 9건을 다 돌릴 수 있다. 기본값을 키우지 않는 이유는
 * 회사 PC 가 그 값으로 돌면 잘리기 때문이다.
 *
 * 예산을 넘기면 **부분 결과 + 경고**로 끝낸다. 통째로 죽는 것보다 낫다.
 */
// 셸 변수가 .env.local 보다 우선한다 — 한 번만 늘려 돌리는 게 흔한 쓰임이다.
const TOTAL_BUDGET_MS =
  Number(process.env.SPEC_BUDGET_MS || env.SPEC_BUDGET_MS) || DEFAULT_BUDGET_MS;

/**
 * 동시에 부를 수 있는 수.
 *
 * **늘려도 총 처리량이 안 는다** — 실측으로 3 은 15분 39초에 5건(143항목),
 * 6 은 16분 51초에 4건(78항목)이었다. 호출끼리 경합해 각각이 느려지고 가장 큰
 * 파일은 per-file 제한에 걸려 죽었다. 3 이 실측 최선이다.
 */
const CONCURRENCY = 3;

/** 항목 배열이 스키마를 벗어나는 경우를 막는다 — 모델 출력이라 형태를 못 믿는다. */
function sanitizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((i) => ({
      key: String(i?.key ?? "").trim(),
      title: String(i?.title ?? "").trim(),
      body: String(i?.body ?? "").trim(),
      included: true,
    }))
    .filter((i) => i.key && i.title);
}

/** 재생성해도 운영자가 뺀 결정은 살아남는다 — item-merge.ts 와 같은 규칙. */
function mergeItems(prev, next) {
  const byKey = new Map((prev ?? []).map((p) => [p.key, p]));
  return next.map((n) => {
    const old = byKey.get(n.key);
    return old ? { ...n, included: old.included } : n;
  });
}

const { data: analyses, error } = await sb
  .from("dev_control_analyses")
  .select("kind, raw_code, analyzed_at")
  .eq("service_id", serviceId);
if (error) {
  console.error(`[spec] 조회 실패: ${error.message}`);
  process.exit(1);
}
// 전형 이름표 — 코드에는 SelTypeCode 와 이름이 이어진 자리가 없다(실측: 같은
// 줄에 있는 건 1~18 나열 한 줄뿐). 대학 자료에서 받아 둔 것을 전 호출에 넘긴다.
// 없으면 코드값 그대로 나간다 — 지어낸 이름보다 낫다.
const { data: atRows } = await sb
  .from("dev_control_admission_types")
  .select("sel_type_code, univ_code, name")
  .eq("service_id", serviceId)
  .order("sel_type_code");
const admissionTypes = (atRows ?? []).map((r) => ({
  selTypeCode: r.sel_type_code,
  univCode: r.univ_code,
  name: r.name,
}));

// 큰 파일부터 — 제어가 제일 많은 파일이 긴 활주로를 먼저 받는다.
const files = bySizeDesc(
  (analyses ?? []).filter((a) => (a.raw_code ?? "").length > 0),
);
if (files.length === 0) {
  console.error(`[spec] ${serviceId} — 저장된 코드가 없다. 먼저 분석이 필요하다`);
  process.exit(1);
}

// 코드를 걷어 온 시각 중 **가장 이른 것**을 쓴다 — 문서 전체가 그만큼 오래됐다는 뜻이다.
const sourceAnalyzedAt = files
  .map((f) => f.analyzed_at)
  .filter(Boolean)
  .sort()[0];

console.log(
  `[spec] ${serviceId} — 파일 ${files.length}건 / 전형 이름표 ${admissionTypes.length}개로 명세 생성`,
);

/**
 * 파일 하나로 명세 항목을 뽑는다.
 *
 * **파일마다 따로 부른다** — 한 번에 다 넣으면 대부분이 사라진다(실측: A.js 단독
 * 18KB 가 56항목인데 9파일 87KB 를 합쳐 넣으면 74항목뿐이다). 프롬프트가 길수록
 * 뒤쪽이 소홀해진다.
 */
function specForFile(file) {
  // 분석 스크립트와 같은 격리 — 도구 전면 차단 + 리포 밖 cwd.
  // 이 리포의 .claude 설정을 상속하면 에이전트가 Bash·git 을 승인 없이 쓴다.
  const out = execFileSync(
    CLAUDE_BIN,
    ["-p", "--disallowedTools", "Bash Edit Write NotebookEdit Task"],
    {
      input: buildSpecPrompt(
        [{ kind: file.kind, code: file.raw_code }],
        admissionTypes,
      ),
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      // 파일 하나라 예전(전체 87KB)보다 짧다. 그래도 넉넉히 준다.
      timeout: PER_FILE_TIMEOUT_MS,
      shell: process.platform === "win32",
      cwd: os.tmpdir(),
    },
  );
  return sanitizeItems(parseSpecJson(out)?.items);
}

// 파일마다 따로 부르되 **병렬로** 간다 — 순차로는 9건이 폴러 제한(20분)을 넘겼다.
// 한 파일이 죽어도 나머지는 살린다: 아홉 번 중 한 번 실패에 문서가 통째로
// 없어지면 안 된다.
const deadline = Date.now() + TOTAL_BUDGET_MS;
const perFile = new Array(files.length).fill(null);
let failed = 0;
let skipped = 0;
let cursor = 0;

async function worker() {
  while (cursor < files.length) {
    const i = cursor;
    cursor += 1;
    if (Date.now() >= deadline) {
      skipped += 1;
      continue;
    }
    const f = files[i];
    try {
      const got = specForFile(f);
      console.log(`[spec]   ${f.kind} ${f.raw_code.length}자 → ${got.length}항목`);
      perFile[i] = got;
    } catch (e) {
      failed += 1;
      console.error(`[spec]   ${f.kind} 실패: ${String(e.message).slice(0, 200)}`);
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const items = mergeFileItems(perFile);
if (items.length === 0) {
  // 제어가 하나도 없다는 문서는 학교에 쓸모가 없다 — 실패로 남겨 사람이 보게 한다.
  console.error("[spec] 항목이 비었다 — 적재하지 않는다");
  process.exit(1);
}
// 일부만 실패한 건 조용히 넘기지 않는다 — 그만큼 문서가 비어 있다는 뜻이다.
if (failed > 0 || skipped > 0) {
  console.error(
    `[spec] 경고 — 파일 ${failed + skipped}/${files.length}건이 빠졌다` +
      `(실패 ${failed}, 시간초과 ${skipped}). 그만큼 문서가 비어 있다`,
  );
}

const { data: prev } = await sb
  .from("dev_control_specs")
  .select("items")
  .eq("service_id", serviceId)
  .maybeSingle();

const merged = mergeItems(prev?.items, items);
const { error: upErr } = await sb.from("dev_control_specs").upsert(
  {
    service_id: serviceId,
    items: merged,
    source_analyzed_at: sourceAnalyzedAt ?? null,
    generated_at: new Date().toISOString(),
  },
  { onConflict: "service_id" },
);
if (upErr) {
  console.error(`[spec] 적재 실패: ${upErr.message}`);
  process.exit(1);
}

const kept = merged.filter((i) => !i.included).length;
console.log(
  `[spec] 완료 — 항목 ${merged.length}건${kept ? ` (이전 제외 ${kept}건 유지)` : ""}`,
);
