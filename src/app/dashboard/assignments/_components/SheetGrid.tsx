import type { AssignmentSheet } from "@/features/assignments/schemas";

/** 시트 usedRange를 원본 행/열 그대로 read-only 그리드로 렌더. */
export function SheetGrid({ sheet }: { sheet: AssignmentSheet }) {
  const cols = sheet.columnCount;
  return (
    <div className="overflow-x-auto p-5">
      <table className="border-collapse text-xs">
        <tbody>
          {sheet.rowsText.map((row, ri) => (
            <tr key={ri}>
              {Array.from({ length: cols }).map((_, ci) => {
                const v = row[ci] ?? "";
                return (
                  <td
                    key={ci}
                    className="border border-line-soft px-2 py-1 align-top text-ink whitespace-pre-wrap"
                  >
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
