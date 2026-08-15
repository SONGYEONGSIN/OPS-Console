import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { KnowledgeDocRow, KnowledgeDocFull } from "./shared";

/**
 * 업무 지식망 열람 — knowledge_docs 인덱스 조회(server 전용).
 *
 * 타입·분류 순서·순수 함수는 shared.ts에 있다. client 컴포넌트가 이 파일을
 * import 하면 server-only 모듈이 클라이언트 번들로 끌려와 빌드가 깨진다.
 *
 * 인덱스는 사본이고 원본은 SharePoint 볼트의 마크다운 파일이다. 이 화면은 읽기 전용이다.
 */

type DbRow = {
  path: string;
  category: string;
  title: string;
  owner: string | null;
  updated: string | null;
  related: string[] | null;
  missing: string[] | null;
  category_mismatch: boolean | null;
  body?: string;
};

const toRow = (r: DbRow): KnowledgeDocRow => ({
  path: r.path,
  category: r.category,
  title: r.title,
  owner: r.owner,
  updated: r.updated,
  related: r.related ?? [],
  missing: r.missing ?? [],
  categoryMismatch: Boolean(r.category_mismatch),
});

/** 목록 — body 제외. 문서가 늘어도 목록 로딩이 무거워지지 않는다. */
export async function listKnowledgeDocs(): Promise<KnowledgeDocRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("knowledge_docs")
    .select("path,category,title,owner,updated,related,missing,category_mismatch")
    .order("category")
    .order("title");
  return ((data ?? []) as DbRow[]).map(toRow);
}

/** 선택된 문서 1건 — 본문 포함. */
export async function getKnowledgeDoc(
  path: string,
): Promise<KnowledgeDocFull | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("knowledge_docs")
    .select(
      "path,category,title,owner,updated,related,missing,category_mismatch,body",
    )
    .eq("path", path)
    .maybeSingle();
  if (!data) return null;
  const r = data as DbRow;
  return { ...toRow(r), body: r.body ?? "" };
}
