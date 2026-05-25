type Props = {
  /** 탭 라벨 (업무분장 / 가격정책) */
  tabLabel: string;
  /** SharePoint 시트 웹 URL — 환경변수 누락 등으로 null이면 안내문구만 */
  webUrl: string | null;
  /** Graph lastModifiedDateTime ISO 8601 — null이면 표시 생략 */
  lastModified: string | null;
};

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16);
  }
}

/**
 * 업무분장 / 가격정책 시트는 셀 병합·서식·이미지 등이 많아 OPS-Console에서
 * 그대로 재현이 어렵다. SharePoint 웹 원본에서 조회·편집하도록 위임.
 * 매뉴얼·계약 등 다른 SharePoint 위임 메뉴와 동일 톤.
 */
export function SharePointPanel({ tabLabel, webUrl, lastModified }: Props) {
  return (
    <section className="p-7">
      <div className="border border-line bg-cream p-8 [box-shadow:3px_4px_0_rgba(21,18,12,0.08)]">
        <h3 className="text-base font-bold text-ink">
          {tabLabel} — SharePoint 웹에서 조회
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          이 시트는 셀 병합·서식·이미지 등이 많아 OPS-Console에서 그대로
          재현하지 않습니다. SharePoint 웹 원본에서 조회·편집하는 것이
          정확합니다.
        </p>

        {lastModified ? (
          <p className="mt-4 text-xs text-muted">
            최근 수정: {formatDateTime(lastModified)}
          </p>
        ) : null}

        <div className="mt-5">
          {webUrl ? (
            <a
              href={webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block border border-vermilion bg-vermilion px-4 py-2 text-sm font-semibold text-cream hover:opacity-90"
            >
              SharePoint에서 열기 →
            </a>
          ) : (
            <p className="text-xs text-vermilion">
              메타 조회 실패 — 환경변수(SHAREPOINT_DRIVE_ID /
              SHAREPOINT_ASSIGNMENTS_ITEM_ID) 또는 Graph 권한을 확인하세요.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
