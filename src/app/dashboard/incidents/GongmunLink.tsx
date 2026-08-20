import { HeaderActionButton } from "@/components/common/HeaderActionButton";

type Props = {
  /** 공문관리대장 SharePoint webUrl. null이면 버튼을 그리지 않는다. */
  url: string | null;
};

/**
 * 공문관리대장 원본 바로가기 — 사고보고 칩 줄 오른쪽.
 * 경위서 발송 시 시행번호가 채번되는 그 대장이다(lib/microsoft/gongmun-ledger).
 * 링크 조회에 실패하면 아예 그리지 않는다 — 깨진 링크를 누르게 하지 않는다.
 */
export function GongmunLink({ url }: Props) {
  if (!url) return null;
  return (
    <HeaderActionButton href={url}>공문관리대장</HeaderActionButton>
  );
}
