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
