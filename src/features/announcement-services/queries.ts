import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AnnouncementServiceCandidate } from "./schemas";

/** PostgREST Max-Rows cap. 한 번만 조회하면 뒤쪽 후보가 조용히 사라진다. */
const CHUNK = 1000;
const MAX_PAGES = 20;

/**
 * 백업 요청 서비스 검색 후보 — 발표 서비스 전량.
 *
 * 범위(최근 N년)는 업로드 시점의 파서가 이미 걸러 놓는다. 여기서 또 거르면 두 곳에
 * 기준이 생겨 어긋난다.
 */
export async function listAnnouncementServiceCandidates(): Promise<
  AnnouncementServiceCandidate[]
> {
  const supabase = await createClient();
  const out: AnnouncementServiceCandidate[] = [];

  for (let p = 0; p < MAX_PAGES; p++) {
    const { data, error } = await supabase
      .from("announcement_services")
      .select("service_id, university_name, service_name")
      .range(p * CHUNK, p * CHUNK + CHUNK - 1);
    if (error) {
      throw new Error(
        `[announcement-services] 후보 조회 실패: ${error.message}`,
      );
    }
    if (!data || data.length === 0) break;
    out.push(
      ...data.map((r) => ({
        service_id: r.service_id as number,
        university_name: (r.university_name as string | null) ?? "",
        service_name: (r.service_name as string | null) ?? "",
      })),
    );
    if (data.length < CHUNK) break;
  }
  return out;
}
