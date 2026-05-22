import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  getMyDataRequestServices,
  getRecipientsForUniversities,
} from "@/features/data-requests/queries";

/** ISO/ymd 문자열의 연도만 delta 만큼 shift (나머지 보존). null 통과. */
function shiftYmdYear(ymd: string | null, delta: number): string | null {
  if (!ymd) return null;
  const m = /^(\d{4})(.*)$/.exec(ymd);
  if (!m) return ymd;
  return `${Number(m[1]) + delta}${m[2]}`;
}

/** ISO 문자열을 KST 기준 YYYY.MM.DD 로 포맷. null/실패 시 빈 문자열. */
function formatYmdDot(iso: string | null): string {
  if (!iso) return "";
  const p = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const y = p.find((x) => x.type === "year")?.value;
  const m = p.find((x) => x.type === "month")?.value;
  const d = p.find((x) => x.type === "day")?.value;
  return y && m && d ? `${y}.${m}.${d}` : "";
}

export default async function DataRequestsPage() {
  const slug = "data-requests";
  await requireMenu(slug);
  const me = await getCurrentOperator();
  const meta = findSidebarMeta(slug);
  if (!meta || !me) return null;
  const pathname = `/dashboard/${slug}`;

  const services = await getMyDataRequestServices(me.email);
  const universities = [...new Set(services.map((s) => s.university_name))];
  const recipients = await getRecipientsForUniversities(universities);

  const byUniv = new Map<string, typeof recipients>();
  for (const r of recipients) {
    const arr = byUniv.get(r.universityName) ?? [];
    arr.push(r);
    byUniv.set(r.universityName, arr);
  }

  const rows: ListRow[] = services.map((s) => ({
    id: s.id,
    name: s.service_name,
    status: "active",
    owner: "",
    universityName: s.university_name,
    serviceName: s.service_name,
    operatorName: s.operator_name ?? s.operator_email ?? "",
    developerName: s.developer_name ?? s.developer_email ?? "",
    writeStartAt: shiftYmdYear(s.write_start_at, 1),
    dataRequestLastSchedule: {
      start: formatYmdDot(s.write_start_at),
      end: formatYmdDot(s.write_end_at),
    },
    dataRequestRecipients: byUniv.get(s.university_name) ?? [],
    dataRequestSender: { email: me.email, name: me.displayName },
  }));

  const config = resolvePageMeta(slug, meta, rows.length);

  return (
    <>
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
      <ListPattern
        title="자료 요청"
        data={{ rows }}
        variant="data-request"
        readOnly
        liveData
      />
    </>
  );
}
