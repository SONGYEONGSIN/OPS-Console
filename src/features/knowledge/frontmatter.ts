import { createHash } from "node:crypto";

/**
 * 지식망 마크다운 1건 파싱 — Graph도 DB도 모르는 순수 함수.
 *
 * frontmatter가 없거나 필드가 빠져도 **버리지 않는다.** 인덱싱에서 빼면 애써 쓴
 * 지식이 화면에서 사라지고, 그건 형식이 어긋난 채 보이는 것보다 나쁘다.
 * 빠진 것은 missing에 모아 나중에 '고칠 목록'으로 쓴다.
 */
export type KnowledgeDoc = {
  /** '플레이북/경위서 발송 절차.md' */
  path: string;
  /** 폴더명. frontmatter가 아니라 실제 위치가 사실이다. */
  category: string;
  title: string;
  owner: string | null;
  /** YYYY-MM-DD. 형식이 아니면 null. */
  updated: string | null;
  related: string[];
  body: string;
  /** 비어 있거나 없는 frontmatter 필드 */
  missing: string[];
  /** frontmatter의 category가 폴더와 다른가 */
  categoryMismatch: boolean;
  contentHash: string;
};

/** 누락으로 셀 필드 — related는 없어도 정상이라 뺀다. */
const REQUIRED = ["title", "category", "owner", "updated"] as const;

function parseList(raw: string): string[] {
  const inner = raw.trim().replace(/^\[|\]$/g, "");
  return inner
    .split(",")
    .map((s) => s.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

export function parseKnowledgeDoc(path: string, text: string): KnowledgeDoc {
  const category = path.split("/")[0] ?? "";
  const fileTitle = (path.split("/").pop() ?? "").replace(/\.md$/, "");

  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  const head = m?.[1] ?? "";
  const body = (m ? text.slice(m[0].length) : text).trim();

  const field = (key: string): string =>
    (new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(head)?.[1] ?? "").trim();

  const fmCategory = field("category");
  const updatedRaw = field("updated");
  const relatedRaw = field("related");

  const missing = REQUIRED.filter((k) =>
    // category는 폴더에서 오므로 항상 있다 — frontmatter 값이 비어도 누락이 아니다.
    k === "category" ? !category : !field(k),
  );

  return {
    path,
    category,
    title: field("title") || fileTitle,
    owner: field("owner") || null,
    updated: /^\d{4}-\d{2}-\d{2}$/.test(updatedRaw) ? updatedRaw : null,
    related: relatedRaw ? parseList(relatedRaw) : [],
    body,
    missing,
    categoryMismatch: Boolean(fmCategory) && fmCategory !== category,
    contentHash: createHash("sha256").update(text, "utf8").digest("hex"),
  };
}
