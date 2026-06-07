import "server-only";

export type DispatchResult = { ok: true } | { ok: false; error: string };

/**
 * OPS → GitHub Actions `workflow_dispatch` 트리거.
 *
 * SmileEDI(워크플로→OPS 메일 잡)와 반대 방향 — OPS 자동화 잡이 GitHub 워크플로를 깨운다.
 * closing-scrape 잡의 run()이 호출. 격주 게이트/스크래핑은 워크플로(Python)가 담당하므로
 * 본 헬퍼는 "워크플로를 1회 dispatch"만 책임진다.
 *
 * 환경변수(필수, 폴백 없음 — 누락 시 즉시 실패):
 * - GITHUB_DISPATCH_TOKEN    : Fine-grained PAT (해당 repo, Actions read/write)
 * - GITHUB_DISPATCH_REPO     : "owner/repo"
 * - GITHUB_DISPATCH_WORKFLOW : 워크플로 파일명 (예: moa-closing-scrape.yml)
 *
 * 성공 = GitHub가 204 No Content 반환.
 * 참고: https://docs.github.com/rest/actions/workflows#create-a-workflow-dispatch-event
 */
export async function dispatchWorkflow(
  opts: { ref?: string; workflow?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<DispatchResult> {
  const env = opts.env ?? process.env;
  const token = (env.GITHUB_DISPATCH_TOKEN ?? "").trim();
  const repo = (env.GITHUB_DISPATCH_REPO ?? "").trim();
  const workflow = (opts.workflow ?? env.GITHUB_DISPATCH_WORKFLOW ?? "").trim();
  const ref = opts.ref ?? "main";

  const missing: string[] = [];
  if (!token) missing.push("GITHUB_DISPATCH_TOKEN");
  if (!repo) missing.push("GITHUB_DISPATCH_REPO");
  if (!workflow) missing.push("GITHUB_DISPATCH_WORKFLOW");
  if (missing.length > 0) {
    return { ok: false, error: `환경변수 누락: ${missing.join(", ")}` };
  }
  if (!repo.includes("/")) {
    return { ok: false, error: `GITHUB_DISPATCH_REPO 형식 오류(owner/repo): ${repo}` };
  }

  const url = `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref }),
    });
  } catch (e) {
    return {
      ok: false,
      error: `GitHub 호출 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (res.status === 204) return { ok: true };

  const text = await res.text().catch(() => "");
  return {
    ok: false,
    error: `GitHub dispatch 실패 (${res.status}): ${text.slice(0, 200)}`,
  };
}
