type Props = {
  /** 미수채권대장 SharePoint webUrl. null이면 버튼을 그리지 않는다. */
  ledgerUrl: string | null;
  /** 수수료입금내역 SharePoint webUrl. null이면 버튼을 그리지 않는다. */
  depositUrl: string | null;
  /** 수수료입금내역은 admin만 본다. */
  isAdmin: boolean;
};

// 목록 헤더 액션 버튼 표준 — ListPattern 생성 버튼(`+ 백업 요청` 등)과 같은 문자열.
// 이 슬롯의 버튼은 대부분 솔리드다. 미수채권에는 생성 버튼이 없어(스크래핑으로 채워지는 목록)
// 버밀리언을 써도 기본 액션과 부딪히지 않는다.
const LINK_CLASS =
  "cursor-pointer border border-vermilion bg-vermilion px-3 py-1 text-xs font-medium text-cream hover:bg-vermilion-deep";

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
