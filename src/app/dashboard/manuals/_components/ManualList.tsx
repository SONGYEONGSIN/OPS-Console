import type { ManualRow } from "@/features/manuals/schemas";

type Props = {
  /** 헤더 텍스트 (예: "A — 원서접수" / "전체" / "폴더") */
  heading: string;
  /** 헤더 보조 hint (예: "15개 매뉴얼") */
  hint?: string;
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
 * 매뉴얼 우측 패널 — /dashboard/settings 의 Panel 톤과 동일 (PanelHeader + 구분선 행).
 * 각 행은 SharePoint 웹 URL <a target="_blank"> 직접 링크.
 */
export function ManualList({ heading, hint, rows }: Props) {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto">
      <header className="mb-2">
        <h3 className="text-xl font-semibold tracking-[-0.02em]">{heading}</h3>
        {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
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
                  className="grid grid-cols-[24px_1fr_80px_60px] items-center gap-3 px-1 py-2 text-sm hover:bg-line-soft"
                >
                  <span className="text-xs text-muted">
                    {isFolder ? "▦" : "§"}
                  </span>
                  <span className="truncate font-medium text-ink">
                    {row.name}
                  </span>
                  <span className="text-right text-xs text-muted">
                    {formatSize(row.size)}
                  </span>
                  <span className="text-right text-xs text-muted">
                    {formatShortDate(row.lastModifiedDateTime)}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
