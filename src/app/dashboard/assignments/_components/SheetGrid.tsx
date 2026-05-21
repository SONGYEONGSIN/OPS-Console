import type { AssignmentSheet } from "@/features/assignments/schemas";

/**
 * 시트 usedRange를 read-only 그리드로 렌더 (업무분장 / 가격정책 공통).
 * 표준 페이지 여백(p-7) + 테두리 컨테이너. 첫 행은 배너로, 첫 열·새 섹션 행은
 * 강조하여 자유 양식 시트도 칸 형식으로 깔끔하게 보이도록 한다.
 */
export function SheetGrid({ sheet }: { sheet: AssignmentSheet }) {
  const cols = sheet.columnCount;
  return (
    <section className="p-7">
      <div className="w-full overflow-x-auto border border-line bg-cream [box-shadow:3px_4px_0_rgba(21,18,12,0.08)]">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {sheet.rowsText.map((row, ri) => {
              const isBanner = ri === 0;
              const isSectionStart = ri > 0 && (row[0] ?? "").trim() !== "";
              return (
                <tr
                  key={ri}
                  className={`border-b border-line-soft ${
                    isBanner
                      ? "bg-washi-raised"
                      : isSectionStart
                        ? "border-t-2 border-ink/15 bg-washi-raised"
                        : ""
                  }`}
                >
                  {Array.from({ length: cols }).map((_, ci) => {
                    const v = row[ci] ?? "";
                    const emphasize = isBanner || ci === 0;
                    return (
                      <td
                        key={ci}
                        className={`border-r border-line-soft px-3 py-2 align-top whitespace-pre-wrap ${
                          emphasize ? "font-semibold text-ink" : "text-ink"
                        }`}
                      >
                        {v}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
