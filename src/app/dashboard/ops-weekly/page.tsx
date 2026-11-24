import { renderOpsWeekly } from "./_screen";

export default async function OpsWeeklyPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; tab?: string; op?: string }>;
}) {
  return renderOpsWeekly("v1", searchParams);
}
