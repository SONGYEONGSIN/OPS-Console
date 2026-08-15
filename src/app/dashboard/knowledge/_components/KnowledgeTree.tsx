"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { KnowledgeGroup } from "@/features/knowledge/shared";

/**
 * 지식망 좌측 트리 — 분류별 묶음 + 제목 검색.
 *
 * 검색은 목록이 이미 로드돼 있어 클라이언트에서 즉시 거른다. 본문 검색은 아직
 * 없다 — 목록에서 body를 빼야 문서가 늘어도 로딩이 안 무거워지기 때문이다.
 *
 * 선택 상태는 URL(`?doc=`)이 갖는다. 새로고침·뒤로가기·링크 공유가 그대로 된다.
 */
export function KnowledgeTree({
  groups,
  selected,
}: {
  groups: KnowledgeGroup[];
  selected: string | null;
}) {
  const pathname = usePathname();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map((g) => ({
        ...g,
        docs: g.docs.filter((d) => d.title.toLowerCase().includes(needle)),
      }))
      .filter((g) => g.docs.length > 0);
  }, [groups, q]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <input
        aria-label="지식망 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="지식망 검색…"
        className="border border-line-soft bg-search-field-bg px-3 py-2 text-sm text-ink outline-none focus:border-ink focus:bg-white"
      />

      <nav
        aria-label="지식망 문서"
        className="min-h-0 flex-1 overflow-y-auto pr-1"
      >
        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-sm text-muted">
            찾는 문서가 없습니다.
          </p>
        ) : (
          filtered.map((g) => (
            <section key={g.category} className="mb-4">
              <h3 className="mb-1 px-2 text-2xs uppercase tracking-[0.14em] text-muted">
                {g.category}
              </h3>
              <ul>
                {g.docs.map((d) => {
                  const active = d.path === selected;
                  const flawed = d.missing.length > 0 || d.categoryMismatch;
                  return (
                    <li key={`${g.category}:${d.path}`}>
                      <Link
                        href={`${pathname}?doc=${encodeURIComponent(d.path)}`}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-baseline gap-2 border-l-2 px-3 py-1.5 text-sm transition-colors ${
                          active
                            ? "border-vermilion bg-vermilion/10 font-medium text-vermilion"
                            : "border-transparent text-ink hover:bg-line-soft"
                        }`}
                      >
                        <span className="flex-1">{d.title}</span>
                        {flawed && (
                          <span className="shrink-0 text-2xs text-muted">
                            형식
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </nav>
    </div>
  );
}
