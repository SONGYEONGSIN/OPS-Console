import { notFound } from "next/navigation";
import { requireMenu } from "@/features/auth/menu-guard";
import { getMeeting } from "@/features/meetings/queries";
import { MeetingEditorWorkspace } from "./_components/MeetingEditorWorkspace";

export default async function MeetingEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireMenu("meetings");
  const { id } = await params;
  const meeting = await getMeeting(id);
  if (!meeting) notFound();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <section className="flex min-h-0 flex-1 flex-col px-5 pb-3 pt-6 md:px-6 lg:px-7">
        <MeetingEditorWorkspace meeting={meeting} />
      </section>
    </div>
  );
}
