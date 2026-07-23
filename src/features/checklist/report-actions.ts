"use server";
// 체크리스트 AI 보고리포트 생성 — 관리자 수동 트리거.
// 작성된 전체 내용을 claude -p로 서술형 HTML 리포트로 정리해 회차에 저장한다.
// claude CLI가 있는 환경(로컬/크론)에서만 생성 가능. 조회는 저장본을 어디서나 렌더.
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/features/auth/permission";
import { getRoundWithItems } from "./queries";
import { buildReportPrompt, extractReportHtml } from "./report-prompt";
import { sanitizeNoteHtml, extractNoteImages } from "./note-html";

// team-briefing/mailbox/dev-control과 동일한 안전 호출:
// 도구 전면 차단 + repo 밖 cwd(프로젝트 .claude 설정 상속 방지) + 프롬프트는 stdin.
const CLAUDE_BIN = process.platform === "win32" ? "claude.cmd" : "claude";

type Result = { ok: true } | { ok: false; error: string };

export async function generateChecklistReport(
  roundId: string,
): Promise<Result> {
  await requireAdmin();

  const data = await getRoundWithItems(roundId);
  if (!data) return { ok: false, error: "회차를 찾을 수 없습니다." };
  if (data.items.length === 0)
    return {
      ok: false,
      error: "작성된 항목이 없어 리포트를 생성할 수 없습니다.",
    };

  // 메모 이미지 → 임시파일 다운로드 (claude가 Read로 열어 표·수치를 리포트에 반영).
  const imagePaths: Record<string, string> = {};
  const tempFiles: string[] = [];
  const urls = data.items.flatMap((i) => extractNoteImages(i.note));
  for (const [idx, url] of urls.entries()) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const ext =
        (url.split(".").pop() ?? "png")
          .replace(/[^a-z0-9]/gi, "")
          .slice(0, 4) || "png";
      const fp = path.join(
        os.tmpdir(),
        `checklist-report-${roundId}-${idx}.${ext}`,
      );
      writeFileSync(fp, buf);
      imagePaths[url] = fp;
      tempFiles.push(fp);
    } catch {
      // 개별 이미지 실패는 건너뛴다 (리포트 생성은 계속).
    }
  }

  const prompt = buildReportPrompt(data.round, data.items, imagePaths);
  let raw: string;
  try {
    raw = execFileSync(
      CLAUDE_BIN,
      ["-p", "--disallowedTools", "Bash Edit Write NotebookEdit Task"],
      {
        input: prompt,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: 360_000, // 개조식 재구성 + 이미지 판독으로 수분 소요 가능
        shell: process.platform === "win32",
        cwd: os.tmpdir(),
      },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `claude 실행 실패(로컬 CLI 필요): ${msg}` };
  } finally {
    for (const f of tempFiles) {
      try {
        unlinkSync(f);
      } catch {
        // best-effort 정리
      }
    }
  }

  const html = sanitizeNoteHtml(extractReportHtml(raw));
  if (!html) return { ok: false, error: "리포트 생성 결과가 비어 있습니다." };

  const sb = createAdminClient();
  const { error } = await sb
    .from("checklist_rounds")
    .update({
      report_html: html,
      report_generated_at: new Date().toISOString(),
    })
    .eq("id", roundId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/checklist/${roundId}/report`);
  return { ok: true };
}
