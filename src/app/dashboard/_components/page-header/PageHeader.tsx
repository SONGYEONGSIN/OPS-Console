import { Breadcrumb } from "./Breadcrumb";
import { PageTabs } from "./PageTabs";
import { PageMeta, type MetaItem } from "./PageMeta";
import { PageHeadline } from "./PageHeadline";

type Props = {
  pathname: string;
  meta?: MetaItem[];
  headline: { title: string; accent?: string };
  description?: string;
};

/**
 * 콘텐츠 페이지 통합 헤더 (Epic 2).
 * 좌측 Breadcrumb + 우측 PageTabs (자동 derive) → PageMeta → PageHeadline 순.
 */
export function PageHeader({
  pathname,
  meta = [],
  headline,
  description,
}: Props) {
  return (
    <header className="border-b border-line-soft px-7 py-5">
      <div className="mb-4 flex items-end justify-between gap-4">
        <Breadcrumb pathname={pathname} />
        <PageTabs pathname={pathname} />
      </div>
      <PageMeta items={meta} />
      <PageHeadline {...headline} description={description} />
    </header>
  );
}
