import { Section, DefList } from "../shared";
import type { ViewProps } from "../types";

function formatDateTime(iso?: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function formatSize(bytes?: number | null): string {
  if (bytes == null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ManualView({ row }: ViewProps) {
  const isFolder = row.manualKind === "folder";

  return (
    <div className="space-y-6">
      <Section title={isFolder ? "폴더 정보" : "파일 정보"}>
        <DefList
          items={[
            { term: "이름", desc: row.name },
            {
              term: "카테고리",
              desc: (
                <span className="inline-block bg-washi-raised px-2 py-0.5 text-xs text-ink">
                  {row.manualCategory ?? "기타"}
                </span>
              ),
            },
            { term: "종류", desc: isFolder ? "폴더" : "파일" },
            { term: "크기", desc: formatSize(row.manualSize) },
            { term: "수정일", desc: formatDateTime(row.manualModified) },
          ]}
        />
      </Section>

      {row.manualWebUrl ? (
        <Section title="액션">
          <a
            href={row.manualWebUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-vermilion px-3 py-1.5 text-sm font-semibold text-cream hover:opacity-90"
          >
            SharePoint에서 열기 →
          </a>
        </Section>
      ) : null}
    </div>
  );
}
