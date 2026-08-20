import { HeaderActionButton } from "@/components/common/HeaderActionButton";

type Props = {
  /** 미수채권대장 SharePoint webUrl. null이면 버튼을 그리지 않는다. */
  ledgerUrl: string | null;
  /** 수수료입금내역 SharePoint webUrl. null이면 버튼을 그리지 않는다. */
  depositUrl: string | null;
  /** 수수료입금내역은 admin만 본다. */
  isAdmin: boolean;
};

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
        <HeaderActionButton href={depositUrl}>
          수수료입금내역
        </HeaderActionButton>
      )}
      {ledgerUrl && (
        <HeaderActionButton href={ledgerUrl}>미수채권대장</HeaderActionButton>
      )}
    </div>
  );
}
