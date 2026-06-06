import { Fragment, type ReactNode } from "react";

const URL_SPLIT_RE = /(https?:\/\/[^\s]+)/g;
const IS_URL_RE = /^https?:\/\//;

/** 텍스트 내 URL을 인라인 링크 노드로 변환 (블록 래퍼 없음). */
export function linkifyNodes(text: string): ReactNode[] {
  return text.split(URL_SPLIT_RE).map((part, i) =>
    IS_URL_RE.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noreferrer noopener"
        className="text-vermilion underline hover:text-vermilion-deep"
      >
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

/**
 * 텍스트 내 URL을 새 탭 링크로 렌더 (읽기 화면용). 줄바꿈/공백 보존.
 */
export function LinkifiedText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <p className={`whitespace-pre-wrap break-words text-ink ${className ?? ""}`}>
      {linkifyNodes(text)}
    </p>
  );
}
