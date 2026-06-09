import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { getCurrentOperator } from "@/features/auth/queries";
import { canEditOperators } from "@/features/auth/permission";
import { requireMenu } from "@/features/auth/menu-guard";
import { listPosts } from "@/features/posts/queries";
import { createPost, updatePost, deletePost } from "@/features/posts/actions";
import { OPERATORS } from "@/features/auth/operators";
import type { PostRow } from "@/features/posts/schemas";
import { ListPagination } from "@/components/common/ListPagination";
import { paginateRows } from "@/lib/list/paginate";

/**
 * /dashboard/notices — 운영부 공지사항 게시판 (DB 연동).
 * admin(부장·팀장)만 작성·수정·삭제, 모두 read.
 */
export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const slug = "notices";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const { page } = await searchParams;
  const posts = await listPosts("notice");
  const { rows, total } = paginateRows(posts.map(postToListRow), page);
  const config = resolvePageMeta(slug, meta, total);

  const me = await getCurrentOperator();
  const isAdmin = canEditOperators(me?.permission ?? null);

  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
      autoRefresh
    />
  );

  async function onPersist(
    row: ListRow,
    isNew: boolean,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    if (isNew) {
      const operator = await getCurrentOperator();
      const ownerLabel =
        operator?.role && operator?.displayName
          ? `${operator.displayName} · ${operator.role}`
          : row.owner || operator?.email || "";
      const result = await createPost({
        domain: "notice",
        title: row.name,
        body: row.body ?? null,
        author_email: operator?.email ?? "",
        author_id: null,
        owner_label: ownerLabel,
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
      variant="post-notice"
      canCreate={isAdmin}
      createLabel="+ 새 공지"
      readOnly={!isAdmin}
      currentUserName={me?.displayName}
      onPersist={onPersist}
      footer={
        <ListPagination key="notices-pagination" total={total} pageSize={30} />
      }
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
