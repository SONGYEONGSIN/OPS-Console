/**
 * 공문 사과 본문 기본값. 순수 헬퍼 — 경위서 생성 시 apology 미지정이면 사용.
 * actions.ts("use server")에서 분리하여 server action으로 노출되지 않도록 둔다.
 */
export function defaultApology(university: string): string {
  return `${university}의 무궁한 발전을 기원합니다.\n\n서비스 제공 중 업무에 불편을 드린 점 진심으로 사과드립니다. 향후 유사한 문제가 재발하지 않도록 서비스 프로세스를 개선하고 더 나은 서비스 제공을 위하여 최선의 노력을 다하겠습니다.`;
}
