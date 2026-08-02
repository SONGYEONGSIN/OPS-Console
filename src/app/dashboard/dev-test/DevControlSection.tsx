import { listDevControlAnalyses } from "@/features/dev-controls/queries";
import { listLatestDevControlRequests } from "@/features/dev-controls/requests-query";
import { listTestableServices } from "@/features/entertest/queries";
import { ListPattern } from "../_components/patterns/ListPattern";
import { ListPagination } from "@/components/common/ListPagination";
import { ScopeChips } from "@/components/common/ScopeChips";
import { buildDevControlRows } from "./dev-control-rows";
import { DevControlSearch } from "./DevControlSearch";

const PAGE_SIZE = 30;

type Props = {
  q?: string;
  page?: string;
  category?: string;
  universityType?: string;
  admissionType?: string;
  /** ScopeChips searchParam 원본. "false"면 전체, 그 외(미지정 포함)는 내 대학. */
  mine?: string;
  /** 로그인 운영자 표시명 — services.operator_name과 비교. */
  myName?: string | null;
};

/** null 제거 + 중복 제거 + 정렬한 distinct 옵션. */
function distinct(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort();
}

/**
 * 개발 탭 — 원서제어 분석 목록 (서버 컴포넌트).
 * listTestableServices + listDevControlAnalyses를 buildDevControlRows로 조립,
 * q(대학명·서비스명) + 전체/내 대학 + 카테고리/대학구분/접수구분 서버 필터 후
 * ListPattern variant="dev-control"로 렌더.
 */
export async function DevControlSection({
  q,
  page,
  category,
  universityType,
  admissionType,
  mine: mineParam,
  myName,
}: Props) {
  const [services, analyses, requests] = await Promise.all([
    listTestableServices(),
    listDevControlAnalyses(),
    listLatestDevControlRequests(),
  ]);

  // 필터 옵션은 전체 서비스 기준 distinct (테스트 탭과 동일 규칙, 지역 제외).
  const options = {
    categoryOptions: distinct(services.map((s) => s.category)),
    universityTypeOptions: distinct(services.map((s) => s.university_type)),
    admissionTypeOptions: distinct(services.map((s) => s.admission_type)),
  };

  // mine 기본 true(내 대학) — 테스트 탭과 동일 규칙, operator_name === 본인.
  const mine = mineParam !== "false";
  const filteredServices = services.filter((s) => {
    if (mine && myName && s.operator_name !== myName) return false;
    if (category && s.category !== category) return false;
    if (universityType && s.university_type !== universityType) return false;
    if (admissionType && s.admission_type !== admissionType) return false;
    return true;
  });

  const rows = buildDevControlRows(filteredServices, analyses, requests);

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
      controlsRow={<DevControlSearch {...options} />}
      inlineFilters={
        <ScopeChips key="dev-control-scope" total={total} mineLabel="내 대학" />
      }
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
