import { redirect } from "next/navigation";
import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { SettingsClient } from "./SettingsClient";
import { getEnvSnapshot } from "./_env";
import { getDbSnapshot } from "./_db";
import type { SettingsSectionKey } from "./SettingsClient";

const SECTION_KEYS: readonly SettingsSectionKey[] = [
  "mail",
  "integrations",
  "build",
  "deploy",
  "db",
] as const;

function pickSection(raw: string | undefined): SettingsSectionKey {
  if (raw && (SECTION_KEYS as readonly string[]).includes(raw)) {
    return raw as SettingsSectionKey;
  }
  return "mail";
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const slug = "settings";
  const me = await requireMenu(slug);

  // 시스템 설정은 admin 전용 — admin 외는 /dashboard로 fallback
  if (me.permission !== "admin") {
    redirect("/dashboard");
  }

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const sp = await searchParams;
  const section = pickSection(sp.section);

  const env = getEnvSnapshot();
  const db = await getDbSnapshot();
  const config = resolvePageMeta(slug, meta);
  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
    />
  );

  return (
    <div className="flex flex-col">
      {header}
      <SettingsClient title={meta.label} section={section} env={env} db={db} />
    </div>
  );
}
