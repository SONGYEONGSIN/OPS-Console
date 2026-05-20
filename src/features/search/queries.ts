import "server-only";
import { listServices } from "@/features/services/queries";
import { listContacts } from "@/features/contacts/queries";
import { listIncidents } from "@/features/incidents/queries";
import { listServicesWithHandover } from "@/features/handover/queries";
import { fetchReceivablesSheet } from "@/features/receivables/queries";
import {
  receivablesToListRow,
  isReceivablesDataRow,
  matchesReceivablesQuery,
} from "@/app/dashboard/receivables/_row-mapper";

export type SearchHit = {
  id: string;
  /** 주 텍스트 (대학명 / 고객명 / 사고 제목) */
  primary: string;
  /** 보조 텍스트 (서비스명·운영자 등) */
  secondary: string;
  /** 클릭 시 이동 경로 */
  href: string;
};

export type SearchResults = {
  services: SearchHit[];
  contacts: SearchHit[];
  incidents: SearchHit[];
  handover: SearchHit[];
  receivables: SearchHit[];
};

const PER = 5;
const empty: SearchResults = {
  services: [],
  contacts: [],
  incidents: [],
  handover: [],
  receivables: [],
};

/**
 * 통합 검색 — 검색 지원 도메인(services / contacts / incidents / handover /
 * receivables)을 병렬로 q 매칭. 각 도메인 결과 클릭 시 해당 list 페이지로 ?q 이동.
 * receivables는 SharePoint Excel sheet — 전체 fetch 후 표시 컬럼에 term 매칭
 * (fetchReceivablesSheet는 React cache로 페이지 fetch와 요청 내 중복 제거).
 * (contracts는 sheet 기반이라 q 미지원 → 제외)
 */
export async function searchAll(query: string): Promise<SearchResults> {
  const term = query.trim();
  if (term.length < 1) return empty;
  const enc = encodeURIComponent(term);

  const [svc, contacts, incidents, handover, sheet] = await Promise.all([
    listServices({ search: term, sort: "service_id_asc", pageSize: PER }),
    listContacts({ search: term, pageSize: PER }),
    listIncidents({ q: term, pageSize: PER }),
    listServicesWithHandover({ q: term, pageSize: PER }),
    fetchReceivablesSheet(),
  ]);

  const receivables: SearchHit[] = sheet
    ? sheet.rows
        .map((_, i) => receivablesToListRow(sheet, i))
        .filter(isReceivablesDataRow)
        .filter((row) => matchesReceivablesQuery(row, term))
        .slice(0, PER)
        .map((row) => ({
          id: row.id,
          primary: row.name,
          secondary: row.author || row.meta || "—",
          href: `/dashboard/receivables?q=${enc}`,
        }))
    : [];

  return {
    services: svc.rows.map((r) => ({
      id: r.id,
      primary: r.university_name,
      secondary: `${r.service_name}${r.operator_name ? ` · ${r.operator_name}` : ""}`,
      href: `/dashboard/services?q=${encodeURIComponent(r.university_name)}`,
    })),
    contacts: contacts.rows.map((r) => ({
      id: r.id,
      primary: r.customer_name,
      secondary: r.university_name,
      href: `/dashboard/contacts?q=${enc}`,
    })),
    incidents: incidents.rows.map((r) => ({
      id: r.id,
      primary: r.title,
      secondary: r.university_name ?? "—",
      href: `/dashboard/incidents?q=${enc}`,
    })),
    handover: handover.rows.map((r) => ({
      id: r.service_id,
      primary: r.university_name,
      secondary: r.service_name,
      href: `/dashboard/handover?q=${enc}`,
    })),
    receivables,
  };
}
