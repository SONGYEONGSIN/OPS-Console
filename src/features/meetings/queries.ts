import "server-only";
import { createClient } from "@/lib/supabase/server";
import { meetingRowSchema, type MeetingRow } from "./schemas";

export async function listMeetings(): Promise<MeetingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[meetings] list fail:", error.message);
    return [];
  }
  const out: MeetingRow[] = [];
  for (const row of data ?? []) {
    const p = meetingRowSchema.safeParse(row);
    if (p.success) out.push(p.data);
  }
  return out;
}

export async function getMeeting(id: string): Promise<MeetingRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const p = meetingRowSchema.safeParse(data);
  return p.success ? p.data : null;
}
