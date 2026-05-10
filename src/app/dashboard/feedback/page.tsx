import { findSidebarMeta } from "../_data";
import { PAGE_META } from "../_data/page-meta-config";
import { derivePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { listPosts } from "@/features/posts/queries";
import {
  createPost,
  updatePost,
  deletePost,
} from "@/features/posts/actions";
import { getCurrentOperator } from "@/features/auth/queries";
import { OPERATORS } from "@/features/auth/operators";
import type { PostRow } from "@/features/posts/schemas";

/**
 * /dashboard/feedback — 시스템 개선 요청 게시판 (DB 연동).
 * 운영부 전원이 작성 가능. 본인 글만 수정·삭제 (admin은 모두).
 */
export default async function FeedbackPage() {
  const slug = "feedback";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = PAGE_META[slug] ?? derivePageMeta(slug, meta);

  const posts = await listPosts("feedback");
  const rows: ListRow[] = posts.map(postToListRow);

  const me = await getCurrentOperator();

  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
    />
  );

  async function onPersist(
    row: ListRow,
    isNew: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    if (isNew) {
      const operator = await getCurrentOperator();
      const result = await createPost({
        domain: "feedback",
        title: row.name,
        body: row.body ?? null,
        author_email: operator?.email ?? "",
        author_id: null,
        owner_label: row.owner || "송영신",
        status: row.status as PostRow["status"],
      });
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    if (row.status === "deleted") {
      const result = await deletePost(row.id);
      return result.ok ? { ok: true } : { ok: false, error: result.error };
    }
    const result = await updatePost(row.id, {
      title: row.name,
      body: row.body ?? null,
      owner_label: row.owner || null,
      status: row.status as PostRow["status"],
    });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="post-feedback"
      canCreate={me?.permission !== "viewer" && me?.permission !== null}
      createLabel="+ 새 개선요청"
      onPersist={onPersist}
    />
  );
}

function postToListRow(post: PostRow): ListRow {
  const author = OPERATORS.find((o) => o.email === post.author_email);
  return {
    id: post.id,
    slug: post.slug ?? undefined,
    name: post.title,
    body: post.body ?? undefined,
    author: author?.name ?? post.author_email,
    owner: post.owner_label ?? "",
    status: post.status as ListRow["status"],
    meta: formatKstDate(post.created_at),
  };
}

function formatKstDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}
