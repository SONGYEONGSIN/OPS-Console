import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseKnowledgeDoc } from "./frontmatter";

/**
 * 업무 지식망 볼트(SharePoint) → knowledge_docs 인덱스.
 *
 * 원본은 파일이고 인덱스는 사본이다. 갈라지면 파일이 이긴다 — 그래서 볼트에 없는
 * path는 인덱스에서 지운다. 안 지우면 삭제된 지식이 검색에 계속 뜬다.
 *
 * 회사 PC가 아니라 서버에서 돈다. Graph로 직접 훑으므로 PC가 꺼져 있어도 무관하다.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";
/** 문서가 아니라 새 문서용 틀 — 인덱싱 대상이 아니다. */
const SKIP_DIRS = new Set(["_templates"]);

export type IndexVaultResult = {
  ok: boolean;
  message: string;
  details?: Record<string, number>;
};

type GraphChild = {
  name: string;
  id: string;
  folder?: { childCount: number };
  file?: unknown;
  lastModifiedDateTime?: string;
};

async function children(
  token: string,
  driveId: string,
  itemId: string,
): Promise<GraphChild[]> {
  const res = await fetch(
    `${GRAPH}/drives/${driveId}/items/${itemId}/children?$select=name,id,folder,file,lastModifiedDateTime&$top=999`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    throw new Error(
      `[knowledge] children ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as { value?: GraphChild[] };
  return json.value ?? [];
}

export async function indexVault(): Promise<IndexVaultResult> {
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const vaultId = process.env.SHAREPOINT_KNOWLEDGE_FOLDER_ID;
  // 설정이 없으면 훑을 것이 없어 0건 성공처럼 보인다 — 그건 조용한 실패다.
  if (!driveId || !vaultId) {
    return {
      ok: false,
      message:
        "SHAREPOINT_DRIVE_ID / SHAREPOINT_KNOWLEDGE_FOLDER_ID 환경변수가 필요합니다.",
    };
  }

  try {
    const token = await getGraphToken();
    const admin = createAdminClient();

    // 이미 인덱싱된 것 — 해시로 변경분만 가려낸다.
    const { data: existingRows, error: selErr } = (await admin
      .from("knowledge_docs")
      .select("path,content_hash")) as {
      data: { path: string; content_hash: string }[] | null;
      error: { message: string } | null;
    };
    if (selErr) throw new Error(`인덱스 조회 실패: ${selErr.message}`);
    const known = new Map(
      (existingRows ?? []).map((r) => [r.path, r.content_hash]),
    );

    const rows: Record<string, unknown>[] = [];
    const seen: string[] = [];
    let unchanged = 0;
    let incomplete = 0;
    let mismatched = 0;

    for (const dir of await children(token, driveId, vaultId)) {
      if (!dir.folder || SKIP_DIRS.has(dir.name)) continue;
      for (const f of await children(token, driveId, dir.id)) {
        if (!f.file || !f.name.endsWith(".md")) continue;
        const path = `${dir.name}/${f.name}`;
        seen.push(path);

        const res = await fetch(
          `${GRAPH}/drives/${driveId}/items/${f.id}/content`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const text = await res.text();
        const doc = parseKnowledgeDoc(path, text);

        if (doc.missing.length) incomplete++;
        if (doc.categoryMismatch) mismatched++;

        // 내용이 그대로면 다시 쓰지 않는다 — 문서가 늘수록 매번 전량 쓰는 비용이 는다.
        if (known.get(path) === doc.contentHash) {
          unchanged++;
          continue;
        }

        rows.push({
          path: doc.path,
          category: doc.category,
          title: doc.title,
          owner: doc.owner,
          updated: doc.updated,
          related: doc.related,
          body: doc.body,
          content_hash: doc.contentHash,
          graph_item_id: f.id,
          missing: doc.missing,
          category_mismatch: doc.categoryMismatch,
          indexed_at: new Date().toISOString(),
        });
      }
    }

    if (rows.length) {
      const { error } = await admin
        .from("knowledge_docs")
        .upsert(rows, { onConflict: "path" });
      if (error) throw new Error(`인덱스 저장 실패: ${error.message}`);
    }

    const gone = [...known.keys()].filter((p) => !seen.includes(p));
    if (gone.length) {
      const { error } = await admin
        .from("knowledge_docs")
        .delete()
        .in("path", gone);
      if (error) throw new Error(`인덱스 삭제 실패: ${error.message}`);
    }

    return {
      ok: true,
      message: `지식망 ${seen.length}건 — 갱신 ${rows.length} · 그대로 ${unchanged} · 삭제 ${gone.length}${incomplete ? ` · 형식 미비 ${incomplete}` : ""}${mismatched ? ` · 분류 어긋남 ${mismatched}` : ""}`,
      details: {
        indexed: seen.length,
        updated: rows.length,
        unchanged,
        removed: gone.length,
        incomplete,
        mismatched,
      },
    };
  } catch (e) {
    return {
      ok: false,
      message: `지식망 인덱싱 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
