type MockReport = {
  id: string;
  title: string;
  rangeLabel: string;
  generatedYmd: string;
  status: "completed" | "draft";
};

/**
 * 1차 MVP placeholder — 향후 실제 생성·저장·PDF 출력 follow-up.
 */
const MOCK_REPORTS: MockReport[] = [
  {
    id: "rpt-q1",
    title: "2026 Q1 운영 종합 리포트",
    rangeLabel: "2026.01 ~ 2026.03",
    generatedYmd: "2026-03-31",
    status: "completed",
  },
  {
    id: "rpt-mar",
    title: "2026 3월 서비스 추세",
    rangeLabel: "2026.03",
    generatedYmd: "2026-04-01",
    status: "completed",
  },
  {
    id: "rpt-h1",
    title: "2026 상반기 사고 명세 (드래프트)",
    rangeLabel: "2026.01 ~ 2026.06",
    generatedYmd: "2026-07-05",
    status: "draft",
  },
];

export function ReportsList() {
  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between border-b border-line pb-2">
        <h3 className="text-base font-semibold text-ink">저장된 리포트</h3>
        <button
          type="button"
          disabled
          aria-label="새 리포트 생성 (준비 중)"
          className="cursor-not-allowed border border-line bg-transparent px-3 py-1 text-xs text-muted"
          title="준비 중"
        >
          + 새 리포트 (준비 중)
        </button>
      </header>
      <ul className="flex flex-col">
        {MOCK_REPORTS.map((r) => (
          <li
            key={r.id}
            className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-line-soft px-3 py-2 text-sm last:border-b-0"
          >
            <span className="font-medium text-ink">§ {r.title}</span>
            <span className="text-xs text-muted">{r.rangeLabel}</span>
            <span className="text-xs text-muted">{r.generatedYmd}</span>
            <span
              className={`text-xs ${
                r.status === "completed" ? "text-vermilion" : "text-muted"
              }`}
            >
              {r.status === "completed" ? "✅ 완료" : "드래프트"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
