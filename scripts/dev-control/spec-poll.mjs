// 학교 명세 폴러 — **자택(macOS/Linux)에서 명세만** 처리한다.
//
// 실행: node scripts/dev-control/spec-poll.mjs        (1회)
//       node scripts/dev-control/spec-poll.mjs --loop (5분 간격 상주)
//
// 회사 PC 폴러(poll-local.ps1)와 나란히 두는 이유: 원서GEN(generator·
// entergenerator)이 회사망 밖에서 TCP 차단이라 **분석(analyze)은 자택에서 못 돈다.**
// 명세(spec)는 저장된 raw_code 만 읽으므로 어디서든 돈다 — claude CLI 만 있으면 된다.
//
// **심박을 보내지 않는다.** poller_heartbeats 의 PK 가 poller_id 단독이라 자택에서
// 보내면 회사 PC 의 dev-control 폴러가 살아 있는 것처럼 덮어쓴다 — 정작 분석이
// 죽어 있는데 화면은 정상으로 보인다.
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ENDPOINT = "/api/dev-controls/analyze-request";

/** 한 번 집어가 처리한다. 주입 가능한 형태로 둔다 — 네트워크 없이 계약을 검사한다. */
export async function runOnce({
  base,
  secret,
  fetchImpl = fetch,
  run,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
}) {
  const headers = { Authorization: `Bearer ${secret}` };
  // 종류를 가려서 집어간다. 안 가리면 analyze 까지 가져와 실패로 태운다 —
  // 회사 PC 가 나중에 할 수 있었던 일을 없애는 것이라 조용한 손실이다.
  const res = await fetchImpl(`${base}${ENDPOINT}?kind=spec`, { headers });
  const claim = await res.json();
  if (!claim?.request) return { claimed: false };

  const { id, service_id: serviceId, kind } = claim.request;

  /**
   * 완료 보고. **재시도한다** — 명세 생성이 10분 가까이 이벤트 루프를 막는 사이
   * 연결이 끊겨 `fetch failed` 로 죽었다(2026-09-04 실측). 그때 명세는 정상
   * 저장됐는데 요청만 failed 로 남아 화면에 실패로 보였다.
   */
  const report = async (ok, message) => {
    for (let i = 0; i < 3; i += 1) {
      try {
        await fetchImpl(`${base}${ENDPOINT}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ id, ok, message }),
        });
        return true;
      } catch {
        if (i < 2) await sleep(2000);
      }
    }
    return false;
  };

  // 서버가 구버전이라 필터를 무시했을 수 있다. 조용히 태우지 않는다.
  if (kind !== "spec") {
    const reported = await report(
      false,
      `자택 폴러는 명세만 처리한다 — ${kind} 는 회사 PC 에서`,
    );
    return { claimed: true, ok: false, reported };
  }

  // **보고 실패가 작업 성패를 뒤집지 않는다.** 일은 끝났는데 기록만 실패로
  // 남으면 화면이 거짓말을 한다.
  let ok = false;
  let message = "";
  try {
    const out = run(serviceId);
    ok = out?.ok !== false;
    message = `spec ${ok ? "완료" : "실패"}`;
  } catch (e) {
    // 이유 없이 실패만 보고하면 손쓸 수가 없다(2026-09-04 ETIMEDOUT 사고).
    message = `spec 실패 — ${String(e?.message ?? e).slice(-250)}`;
  }
  const reported = await report(ok, message);
  return { claimed: true, ok, reported };
}

/** 실제 실행 — dev-control-spec.mjs 를 그대로 부른다. 로직을 두 벌로 만들지 않는다. */
function runSpec(serviceId) {
  const output = execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL("../dev-control-spec.mjs", import.meta.url)),
      String(serviceId),
    ],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024, cwd: os.tmpdir() },
  );
  process.stdout.write(output);
  return { ok: true, output };
}

function readEnv() {
  const text = fs.readFileSync(
    new URL("../../.env.local", import.meta.url),
    "utf8",
  );
  const env = Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
  );
  return {
    base: (env.OPS_CONSOLE_BASE_URL ?? "").replace(/\/$/, ""),
    secret: env.CRON_SECRET ?? "",
  };
}

// 레포 경로에 비ASCII(한글)가 있으면 `file://` + argv 문자열 이어붙이기는
// **절대 일치하지 않는다** — import.meta.url 은 퍼센트 인코딩된다. 그러면 이
// 블록이 안 돌아 폴러가 exit 0 으로 아무 일도 안 한다(실제로 겪었다).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { base, secret } = readEnv();
  if (!base || !secret) {
    console.error("[spec-poll] OPS_CONSOLE_BASE_URL / CRON_SECRET 미설정 — 종료");
    process.exit(1);
  }
  const loop = process.argv.includes("--loop");
  const tick = async () => {
    try {
      const r = await runOnce({ base, secret, run: runSpec });
      if (r.claimed) {
        // 보고를 못 했으면 그것도 말한다 — 화면과 실제가 갈린 상태다.
        const note = r.reported ? "" : " (완료 보고 실패 — 화면에 안 반영됨)";
        console.log(`[spec-poll] 처리 ${r.ok ? "성공" : "실패"}${note}`);
      }
    } catch (e) {
      console.error(`[spec-poll] 예외: ${e.message}`);
    }
  };
  await tick();
  if (loop) setInterval(tick, 5 * 60 * 1000);
}
