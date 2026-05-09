import { CrumbBar } from "./CrumbBar";
import { PageMeta, type MetaItem } from "./PageMeta";
import { PageHeadline } from "./PageHeadline";

type Props = {
  pathname: string;
  meta?: MetaItem[];
  headline: { title: string; accent?: string };
  description?: string;
};

/**
 * 콘텐츠 페이지 통합 헤더 (Epic 2 + mockup folio-dashboard.html 매칭).
 *
 * 두 영역으로 분리:
 *   1) CrumbBar (washi-raised 띠) — breadcrumb + 동적 탭
 *   2) ContentHead (cream bg) — meta over-line + h1 headline + 설명
 */
export function PageHeader({
  pathname,
  meta = [],
  headline,
  description,
}: Props) {
  return (
    <>
      <CrumbBar pathname={pathname} />
      <header className="bg-cream px-7 pb-5 pt-6">
        <PageMeta items={meta} />
        <PageHeadline {...headline} description={description} />
      </header>
    </>
  );
}
