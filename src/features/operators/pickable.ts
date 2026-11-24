import { isSalesTeam } from "@/features/auth/operators";

/**
 * 운영자를 고르는 칸(백업 대체자·인수인계 상대·서비스 담당·AI 작업 공유·메일함 위임)의 후보.
 * 재직 중(active)이고 **영업팀이 아닌** 사람 — 영업팀은 사고보고 메일 참조용으로만 조직권한에
 * 등재돼 운영 업무를 맡지 않는다.
 */
export function pickableOperators<
  T extends { status: string; team: string | null },
>(operators: readonly T[]): T[] {
  return operators.filter((o) => o.status === "active" && !isSalesTeam(o.team));
}
