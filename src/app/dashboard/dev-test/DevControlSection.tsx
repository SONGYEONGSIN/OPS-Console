import { listDevControlAnalyses } from "@/features/dev-controls/queries";
import { listLatestDevControlRequests } from "@/features/dev-controls/requests-query";
import { listTestableServices } from "@/features/entertest/queries";
import { ListPattern } from "../_components/patterns/ListPattern";
import { ListPagination } from "@/components/common/ListPagination";
import { buildDevControlRows } from "./dev-control-rows";
import { DevControlSearch } from "./DevControlSearch";

const PAGE_SIZE = 30;

type Props = {
  q?: string;
  page?: string;
};

/**
 * 개발 탭 — 원서제어 분석 목록 (서버 컴포넌트).
 * listTestableServices + listDevControlAnalyses를 buildDevControlRows로 조립,
 * q(대학명·서비스명) 서버 필터 후 ListPattern variant="dev-control"로 렌더.
 */
export async function DevControlSection({ q, page }: Props) {
  const [services, analyses, requests] = await Promise.all([
    listTestableServices(),
    listDevControlAnalyses(),
    listLatestDevControlRequests(),
  ]);

  const rows = buildDevControlRows(services, analyses, requests);

  const query = (q ?? "").trim().toLowerCase();
  const filtered = query
    ? rows.filter((r) =>
        `${r.universityName ?? ""} ${r.serviceName ?? ""}`
          .toLowerCase()
          .includes(query),
      )
    : rows;

  const total = filtered.length;
  const pageNum = page ? Math.max(1, Number(page)) : 1;
  const paged = filtered.slice((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);

  return (
    <ListPattern
      title="개발 · 원서제어 분석"
      data={{ rows: paged }}
      variant="dev-control"
      readOnly
      liveData
      controlsRow={<DevControlSearch />}
      footer={
        <ListPagination
          key="dev-control-pagination"
          total={total}
          pageSize={PAGE_SIZE}
        />
      }
    />
  );
}
