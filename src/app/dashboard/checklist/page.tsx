import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { listRounds } from "@/features/checklist/queries";
import { RoundsList } from "./_components/RoundsList";
import { NewRoundButton } from "./_components/NewRoundButton";

export default async function ChecklistPage() {
  const slug = "checklist";
  await requireMenu(slug);
  const meta = findSidebarMeta(slug);
  if (!meta) return null;

  const rounds = await listRounds();

  const pathname = `/dashboard/${slug}`;
  const config = resolvePageMeta(slug, meta);

  return (
    <div className="flex flex-col">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <section className="flex h-full min-h-0 flex-col p-5 md:p-6 lg:p-7">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-bold text-ink">{meta.label}</h2>
          <NewRoundButton
            rounds={rounds.map((r) => ({ id: r.id, title: r.title }))}
          />
        </header>
        <RoundsList rounds={rounds} />
      </section>
    </div>
  );
}
