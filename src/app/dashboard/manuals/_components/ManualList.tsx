import type { ManualRow } from "@/features/manuals/schemas";

type Props = {
  /** 헤더 텍스트 (예: "A — 원서접수" / "전체" / "폴더") */
  heading: string;
  rows: ManualRow[];
};

function formatShortDate(iso?: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
  }).format(new Date(iso));
}

function formatSize(bytes?: number | null): string {
  if (bytes == null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * 매뉴얼 우측 파일 리스트.
 * - 헤더에 카테고리 이름 + 개수
 * - 각 row는 SharePoint 웹 URL <a target="_blank"> 직접 링크
 * - 폴더 row는 ▦ 아이콘, 파일은 § 아이콘
 */
export function ManualList({ heading, rows }: Props) {
  return (
    <section className="flex-1 px-7 py-4">
      <header className="mb-3 flex items-baseline gap-2 border-b border-line pb-2">
        <h2 className="text-base font-semibold text-ink">{heading}</h2>
        <span className="text-sm text-muted">({rows.length})</span>
      </header>

      {rows.length === 0 ? (
        <p className="px-3 py-8 text-center text-sm text-muted">
          이 카테고리에 매뉴얼 없음
        </p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((row) => {
            const isFolder = row.kind === "folder";
            return (
              <li
                key={row.id}
                className="border-b border-line-soft last:border-b-0"
              >
                <a
                  href={row.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-washi-raised"
                >
                  <span className="text-muted">{isFolder ? "▦" : "§"}</span>
                  <span className="flex-1 truncate text-sm font-medium text-ink">
                    {row.name}
                  </span>
                  <span className="w-20 shrink-0 text-right text-xs text-muted">
                    {formatSize(row.size)}
                  </span>
                  <span className="w-16 shrink-0 text-right text-xs text-muted">
                    {formatShortDate(row.lastModifiedDateTime)}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
