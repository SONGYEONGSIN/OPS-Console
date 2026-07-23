// 보고리포트 본문 렌더 (관리자·공개 공용). 정화된 report_html을 문서로 렌더하고
// h3 카테고리와 최상위 항목(li) 앞에 공통 SVG 구분자를 주입한다.
// 상호작용 없음(서버·클라 양쪽 사용 가능).

// 공통 구분자 SVG(삼각형). h3 카테고리 + 최상위 li 제목 앞에 공통 사용.
// fill=currentColor로 text-vermilion 상속. 중첩 li는 CSS로 숨기고 '·'로 대체.
const MARKER_SVG =
  '<svg viewBox="0 0 10 10" aria-hidden="true"><path fill="currentColor" d="M2 1l6 4-6 4z"/></svg>';

// 임원 보고용 개조식 아웃라인. 카테고리(h3)엔 밝은 그레이 밴드 + SVG 구분자,
// 최상위 항목(li)엔 동일 SVG 마커, 하위(중첩) 항목엔 '·'. 표는 폭 통일(w-full)·테두리.
const REPORT_CLASS =
  "[&>*:first-child]:mt-0 [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:border-b [&_h2]:border-line [&_h2]:pb-1 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:flex [&_h3]:items-center [&_h3]:gap-1.5 [&_h3]:rounded-sm [&_h3]:bg-line-soft/60 [&_h3]:px-2 [&_h3]:py-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ink [&_h3_svg]:h-2.5 [&_h3_svg]:w-2.5 [&_h3_svg]:shrink-0 [&_h3_svg]:text-vermilion [&_p]:my-2 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-ink [&_ul]:my-1.5 [&_ul]:list-none [&_ul]:pl-4 [&_ul_ul]:my-1 [&_li]:relative [&_li]:my-1 [&_li]:pl-4 [&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-ink [&_li>svg]:absolute [&_li>svg]:left-0 [&_li>svg]:top-[0.45em] [&_li>svg]:h-[7px] [&_li>svg]:w-[7px] [&_li>svg]:shrink-0 [&_li>svg]:text-vermilion [&_ul_ul_li>svg]:hidden [&_ul_ul_li]:before:absolute [&_ul_ul_li]:before:left-0 [&_ul_ul_li]:before:text-muted [&_ul_ul_li]:before:content-['·'] [&_b]:font-semibold [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_th]:border-line [&_th]:bg-line-soft [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1 [&_td]:align-top [&_td]:break-words";

/** 저장 시점 sanitize된 report_html + 공통 SVG 마커(신뢰 상수)만 주입해 렌더. */
export function ReportBody({ html }: { html: string }) {
  const withMarkers = html
    .replaceAll("<h3>", `<h3>${MARKER_SVG}`)
    .replaceAll("<li>", `<li>${MARKER_SVG}`);
  return (
    <article
      className={REPORT_CLASS}
      dangerouslySetInnerHTML={{ __html: withMarkers }}
    />
  );
}
