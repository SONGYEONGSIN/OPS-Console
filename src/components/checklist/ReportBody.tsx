// 보고리포트 본문 렌더 (관리자·공개 공용). 정화된 report_html을 문서로 렌더하고
// h3 카테고리 앞에 공통 SVG 구분자를 주입한다. 상호작용 없음(서버·클라 양쪽 사용 가능).

// h3 카테고리 앞 공통 SVG 구분자(삼각형). fill=currentColor로 text-vermilion 상속.
const H3_MARKER =
  '<svg viewBox="0 0 10 10" aria-hidden="true"><path fill="currentColor" d="M2 1l6 4-6 4z"/></svg>';

// 임원 보고용 개조식 아웃라인 — 최상위 불릿 '–', 하위 불릿 '·'.
// 카테고리(h3)엔 밝은 그레이 밴드 + vermilion SVG 구분자. 표는 폭 통일(w-full)·테두리.
const REPORT_CLASS =
  "[&>*:first-child]:mt-0 [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:border-b [&_h2]:border-line [&_h2]:pb-1 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:flex [&_h3]:items-center [&_h3]:gap-1.5 [&_h3]:rounded-sm [&_h3]:bg-line-soft/60 [&_h3]:px-2 [&_h3]:py-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ink [&_h3_svg]:h-2.5 [&_h3_svg]:w-2.5 [&_h3_svg]:shrink-0 [&_h3_svg]:text-vermilion [&_p]:my-2 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-ink [&_ul]:my-1.5 [&_ul]:list-none [&_ul]:pl-4 [&_ul_ul]:my-1 [&_li]:relative [&_li]:my-1 [&_li]:pl-4 [&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-ink [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:text-muted [&_li]:before:content-['–'] [&_ul_ul_li]:before:content-['·'] [&_b]:font-semibold [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_th]:border-line [&_th]:bg-line-soft [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1 [&_td]:align-top [&_td]:break-words";

/** 저장 시점 sanitize된 report_html + h3 SVG 구분자(신뢰 상수)만 주입해 렌더. */
export function ReportBody({ html }: { html: string }) {
  return (
    <article
      className={REPORT_CLASS}
      dangerouslySetInnerHTML={{
        __html: html.replaceAll("<h3>", `<h3>${H3_MARKER}`),
      }}
    />
  );
}
