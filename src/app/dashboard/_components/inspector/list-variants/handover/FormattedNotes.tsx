import { linkifyNodes } from "./LinkifiedText";

const SECTION_RE = /^\s*\(\d+\)/;
const BULLET_RE = /^\s*[-•]\s?/;
const CAUTION_RE = /^\s*※/;

/**
 * 작업 내용 등 참고 텍스트를 읽기 좋게 렌더 (편집은 자유 textarea 유지).
 * - (1)/(2) 소제목 → 볼드
 * - '-' 불릿 → • 정리
 * - ※ 주의 → 버밀리언 강조
 * - URL → 새 탭 링크 / 들여쓰기 보존
 */
export function FormattedNotes({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-0.5 break-words text-ink">
      {lines.map((line, i) => {
        if (line.trim() === "") return <div key={i} className="h-2" />;
        const lead = line.match(/^(\s*)/)?.[1].length ?? 0;
        const indent = lead >= 6 ? "pl-6" : lead >= 2 ? "pl-3" : "";

        if (SECTION_RE.test(line)) {
          return (
            <p key={i} className={`mt-1 font-bold text-ink-soft ${indent}`}>
              {line.trim()}
            </p>
          );
        }
        if (CAUTION_RE.test(line)) {
          return (
            <p key={i} className={`text-vermilion ${indent}`}>
              {linkifyNodes(line.trim())}
            </p>
          );
        }
        if (BULLET_RE.test(line)) {
          return (
            <p key={i} className={`${indent}`}>
              <span className="text-muted">• </span>
              {linkifyNodes(line.replace(BULLET_RE, ""))}
            </p>
          );
        }
        return (
          <p key={i} className={indent}>
            {linkifyNodes(line.trim())}
          </p>
        );
      })}
    </div>
  );
}
