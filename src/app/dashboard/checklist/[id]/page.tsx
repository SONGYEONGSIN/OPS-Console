import { notFound } from "next/navigation";
import { requireMenu } from "@/features/auth/menu-guard";
import { getRoundWithItems, listTokens } from "@/features/checklist/queries";
import { RoundDetail } from "./_components/RoundDetail";

export default async function ChecklistRoundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireMenu("checklist");
  const { id } = await params;
  const data = await getRoundWithItems(id);
  if (!data) notFound();
  const tokens = await listTokens(id);
  return (
    <div className="p-5 md:p-6 lg:p-7">
      <RoundDetail round={data.round} items={data.items} tokens={tokens} />
    </div>
  );
}
