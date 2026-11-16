/** 탭 본문의 React key — 보고서가 바뀌면 입력 상태를 가진 하위 컴포넌트가 전부 다시 마운트된다. */
export function bodyKeyOf(args: {
  reportId: string | null;
  weekStart: string;
  op: string;
  tab: string;
}): string {
  const { reportId, weekStart, op, tab } = args;
  return reportId !== null ? `${reportId}:${tab}` : `${weekStart}:${op}:${tab}`;
}
