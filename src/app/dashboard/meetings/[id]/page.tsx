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
  return <MeetingEditorWorkspace meeting={meeting} />;
}
