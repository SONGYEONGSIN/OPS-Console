type Props = {
  /** 공문관리대장 SharePoint webUrl. null이면 버튼을 그리지 않는다. */
  url: string | null;
};

// 목록 헤더 액션 버튼 표준 — 미수채권 WorkbookLinks와 같은 문자열.
// 사고보고에는 솔리드 생성 버튼(+ 사고 보고)이 이미 있어, 원본 문서 링크는
// 아웃라인으로 두어 기본 액션과 무게가 부딪히지 않게 한다.
const LINK_CLASS =
  "cursor-pointer border border-line-soft bg-transparent px-3 py-1 text-xs font-medium text-ink transition-colors hover:border-vermilion hover:bg-vermilion hover:text-cream";

/**
 * 공문관리대장 원본 바로가기 — 사고보고 칩 줄 오른쪽.
 * 경위서 발송 시 시행번호가 채번되는 그 대장이다(lib/microsoft/gongmun-ledger).
 * 링크 조회에 실패하면 아예 그리지 않는다 — 깨진 링크를 누르게 하지 않는다.
 */
export function GongmunLink({ url }: Props) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={LINK_CLASS}
    >
      공문관리대장
    </a>
  );
}
