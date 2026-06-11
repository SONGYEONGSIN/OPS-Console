import type { ConsoleLogEntry } from "../mock-log-pool";

type LogTickerProps = {
  lines: ConsoleLogEntry[];
};

/** "[TAG] 본문" 모양에서 선행 태그와 나머지 본문을 분리한다. */
function splitTag(text: string): { tag: string | null; rest: string } {
  const match = text.match(/^(\[[^\]]+\])\s*(.*)$/);
  if (!match) return { tag: null, rest: text };
  return { tag: match[1], rest: match[2] };
}

/**
 * 가로 흐름 콘솔 로그 티커.
 * - 트랙을 translateX로 좌측 크롤(60s linear infinite — 천천히)
 * - @keyframes는 공유 globals.css 대신 컴포넌트 내부 <style>로 스코프
 */
export default function LogTicker({ lines }: LogTickerProps) {
  return (
    <div className="overflow-hidden bg-ink py-1 font-mono text-2xs text-cream">
      <style>{`
        @keyframes log-ticker-crawl {
          to { transform: translateX(-100%); }
        }
        .log-ticker-track {
          display: inline-block;
          padding-left: 100%;
          white-space: nowrap;
          animation: log-ticker-crawl 60s linear infinite;
        }
      `}</style>
      {lines.length > 0 ? (
        <div className="log-ticker-track" data-ticker-track>
          {lines.map((line, i) => {
            const { tag, rest } = splitTag(line.text);
            return (
              <span key={i} className="mx-6 inline-block">
                {tag ? <b className="font-bold text-gold">{tag}</b> : null}
                {tag && rest ? " " : null}
                {rest ? <span>{rest}</span> : null}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
