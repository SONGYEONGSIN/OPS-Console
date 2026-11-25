import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  SEVERITY_VALUES,
  severitySchema,
  type SeverityCriteria,
} from "./schemas";

const criteriaRowsSchema = z.array(
  z.object({ severity: z.string(), description: z.string() }),
);
const criteriaMapSchema = z.record(severitySchema, z.string());

/**
 * 사고 등급별 판단 기준 — 폼의 `?` 툴팁이 읽는다.
 * 세션 클라이언트로 읽는다: 읽기 정책이 `using (true)` 라 service_role 이 필요 없다.
 * 빠진 등급은 `""`, 모르는 등급 행은 버린다. 못 읽으면 `null` — 코드에 기본 문구 사본을 두지 않는다.
 */
export async function getSeverityCriteria(): Promise<SeverityCriteria | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incident_severity_criteria")
    .select("severity, description");
  if (error) return null;

  const rows = criteriaRowsSchema.safeParse(data);
  if (!rows.success) return null;

  const byGrade = new Map(rows.data.map((r) => [r.severity, r.description]));
  const map = criteriaMapSchema.safeParse(
    Object.fromEntries(SEVERITY_VALUES.map((s) => [s, byGrade.get(s) ?? ""])),
  );
  return map.success ? map.data : null;
}
