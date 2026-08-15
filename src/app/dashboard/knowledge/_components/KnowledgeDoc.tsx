"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isStale, type KnowledgeDocFull } from "@/features/knowledge/shared";

/**
 * 지식망 문서 뷰어 — 읽기 전용. 편집은 옵시디언에서 한다.
 *
 * react-markdown은 기본적으로 원시 HTML을 렌더하지 않는다(rehype-raw 미사용).
 * 볼트는 사람이 쓰는 곳이라 HTML이 섞일 수 있는데, 그대로 실행되면 안 된다.
 */
export function KnowledgeDocView({
  doc,
  allPaths,
}: {
  doc: KnowledgeDocFull;
  /** 실제로 존재하는 문서 경로 — related 링크를 걸지 말지 판단한다. */
  allPaths: string[];
}) {
  const pathname = usePathname();
  const stale = isStale(doc.updated);

  /** related는 제목만 적히므로 경로를 찾아 붙인다. 없으면 링크를 안 건다. */
  const pathOf = (title: string): string | null =>
    allPaths.find((p) => (p.split("/").pop() ?? "").replace(/\.md$/, "") === title) ??
    null;

  return (
    <article className="min-w-0">
      <header className="mb-6 border-b-2 border-ink pb-4">
        <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
          {doc.category}
        </p>
        <h2 className="text-2xl font-bold tracking-[-0.01em] text-ink">
          {doc.title}
        </h2>
        <p className="mt-1 text-xs text-muted">
          {doc.owner ? `작성 ${doc.owner}` : "작성자 없음"}
          {doc.updated && <> · 수정 {doc.updated}</>}
        </p>

        {stale && (
          <p className="mt-3 border border-line-soft bg-washi px-3 py-2 text-xs text-ink-soft">
            마지막 수정이 <b>6개월</b>보다 오래됐습니다. 내용이 지금과 맞는지
            확인하고 고쳐주세요.
          </p>
        )}
        {doc.missing.length > 0 && (
          <p className="mt-2 border border-line-soft bg-washi px-3 py-2 text-xs text-ink-soft">
            형식이 빠졌습니다 — <b>{doc.missing.join(", ")}</b>. 옵시디언에서
            채워주세요.
          </p>
        )}
        {doc.categoryMismatch && (
          <p className="mt-2 border border-line-soft bg-washi px-3 py-2 text-xs text-ink-soft">
            문서에 적힌 분류가 <b>폴더</b>와 다릅니다. 화면은 폴더를 따릅니다 —
            파일이 어디 있는지가 사실이기 때문입니다.
          </p>
        )}

        {doc.related.length > 0 && (
          <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
            <span className="text-muted">관련</span>
            {doc.related.map((r) => {
              const p = pathOf(r);
              return p ? (
                <Link
                  key={r}
                  href={`${pathname}?doc=${encodeURIComponent(p)}`}
                  className="border-b border-vermilion/40 text-vermilion hover:border-vermilion"
                >
                  {r}
                </Link>
              ) : (
                <span key={r} className="text-muted line-through">
                  {r}
                </span>
              );
            })}
          </p>
        )}
      </header>

      {/* 읽기 폭을 72ch로 묶어뒀더니 넓은 화면에서 오른쪽 절반이 통째로 비었다.
          지식망 문서는 표·코드블록이 많아 그 폭이 특히 아깝다 — 열을 다 쓴다. */}
      <div className="knowledge-body text-sm leading-relaxed text-ink">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.body}</ReactMarkdown>
      </div>
    </article>
  );
}
