type Props = {
  /** 미수채권대장 SharePoint webUrl. null이면 버튼을 그리지 않는다. */
  ledgerUrl: string | null;
  /** 수수료입금내역 SharePoint webUrl. null이면 버튼을 그리지 않는다. */
  depositUrl: string | null;
  /** 수수료입금내역은 admin만 본다. */
  isAdmin: boolean;
};

// 목록 헤더 액션 버튼 표준(외곽선 변형) — services의 BulkPasteAnnouncements와 동일.
// 같은 슬롯에는 솔리드(bg-ink) 변형도 있으나, 이 둘은 외부 파일로 나가는 보조 동작이라 외곽선을 쓴다.
const LINK_CLASS =
  "cursor-pointer border border-line bg-transparent px-3 py-1 text-xs text-ink transition-colors hover:bg-washi";

/**
 * 원본 엑셀 바로가기 — 미수채권 칩 줄 오른쪽.
 * 링크 조회에 실패한 항목은 아예 그리지 않는다(깨진 링크를 누르게 하지 않는다).
 */
export function WorkbookLinks({ ledgerUrl, depositUrl, isAdmin }: Props) {
  const showDeposit = isAdmin && Boolean(depositUrl);
  if (!ledgerUrl && !showDeposit) return null;

  return (
    <div className="flex items-center gap-1">
      {showDeposit && depositUrl && (
        <a
          href={depositUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          수수료입금내역
        </a>
      )}
      {ledgerUrl && (
        <a
          href={ledgerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={LINK_CLASS}
        >
          미수채권대장
        </a>
      )}
    </div>
  );
}
