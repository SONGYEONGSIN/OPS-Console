import Link from "next/link";
import { findSidebarMeta } from "../../_data";
import { resolvePageMeta } from "../../_data/page-meta-derive";
import { PageHeader } from "../../_components/page-header/PageHeader";
import { HandoverTabs } from "../HandoverTabs";
import { CategoryNav } from "./CategoryNav";
import { HandoverForm } from "./HandoverForm";
import { requireMenu } from "@/features/auth/menu-guard";
import {
  getHandoverByServiceId,
  getServiceForHandover,
} from "@/features/handover/queries";
import {
  HANDOVER_FIELD_KEYS,
  type HandoverFieldKey,
} from "@/features/handover/categories";

type Props = { params: Promise<{ serviceId: string }> };

export default async function HandoverDetailPage({ params }: Props) {
  const slug = "handover";
  await requireMenu(slug);

  const { serviceId } = await params;
  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = "/dashboard/handover";
  const config = resolvePageMeta(slug, meta);

  const service = await getServiceForHandover(serviceId);
  if (!service) {
    return (
      <div className="p-7">
        <Link
          href="/dashboard/handover"
          className="text-sm text-vermilion"
        >
          ← 서비스 목록
        </Link>
        <p className="mt-4 text-muted">서비스를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const record = await getHandoverByServiceId(serviceId);
  const initial = {} as Record<HandoverFieldKey, string | null>;
  for (const k of HANDOVER_FIELD_KEYS) initial[k] = record?.[k] ?? null;

  return (
    <div>
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={{
          title: `${service.university_name} · ${service.service_name}`,
        }}
        description={`운영자 ${service.operator_name ?? "—"} · ${service.application_type}`}
      />
      <div className="px-7 pt-4">
        <Link
          href="/dashboard/handover"
          className="text-sm text-vermilion hover:underline"
        >
          ← 서비스 목록
        </Link>
      </div>
      <HandoverTabs />
      <section className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[240px_1fr] md:p-6 lg:p-7">
        <CategoryNav />
        <HandoverForm serviceId={serviceId} initial={initial} />
      </section>
    </div>
  );
}
