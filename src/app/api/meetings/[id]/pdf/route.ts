import { renderToBuffer } from "@react-pdf/renderer";
import { getMeeting } from "@/features/meetings/queries";
import { renderMeetingPdf } from "@/lib/pdf/meeting-pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const meeting = await getMeeting(id);
  if (!meeting) return new Response("not found", { status: 404 });
  const buffer = await renderToBuffer(renderMeetingPdf(meeting));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="meeting-${id}.pdf"`,
    },
  });
}
