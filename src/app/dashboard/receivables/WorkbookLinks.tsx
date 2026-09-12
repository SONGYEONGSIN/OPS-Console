import { HeaderActionButton } from "@/components/common/HeaderActionButton";

type Props = {
  /** 수수료입금내역은 admin만 본다. */
  isAdmin: boolean;
};

/**
 * 원본 엑셀 바로가기 — 미수채권 칩 줄 오른쪽.
 *
 * **버튼은 늘 그린다.** 예전엔 링크 조회에 실패한 항목을 아예 안 그렸는데,
 * 그러면 '기능이 없는 것'과 구분되지 않는다 — 총괄장에서 실제로 겪었다
 * (2026-09-09). 주소는 창구가 클릭 시점에 풀고, 못 풀면 이유를 화면에 띄운다.
 *
 * `isAdmin` 은 남긴다. 이건 조회 실패로 **우연히** 사라지는 게 아니라 권한에
 * 따라 **의도적으로** 안 보이는 것이라 성격이 다르다(서버도 라우트에서 막는다).
 */
export function WorkbookLinks({ isAdmin }: Props) {
  return (
    <div className="flex items-center gap-1">
      {isAdmin && (
        <HeaderActionButton href="/dashboard/workbook/receivables-deposit">
          수수료입금내역
        </HeaderActionButton>
      )}
      <HeaderActionButton href="/dashboard/workbook/receivables-ledger">
        미수채권대장
      </HeaderActionButton>
    </div>
  );
}
