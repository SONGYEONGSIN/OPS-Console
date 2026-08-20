"use client";

import type { ReactNode } from "react";

/**
 * 목록 헤더 오른쪽 액션 버튼 — `+ 백업 요청`, `등기대장` 같은 것들.
 *
 * 표준이 **컴포넌트가 아니라 복사해 쓰는 클래스 문자열**이었다. `ListPattern`에
 * 인라인으로 있었고, 미수채권이 "같은 문자열"이라는 주석과 함께 베껴 썼고,
 * 세 번째로 옮겨 적을 때 결국 다른 치수가 들어갔다(2026-08-20 우편물 탭).
 *
 * 이제 치수는 여기서만 정한다. 이 자리에 버튼을 더할 때 이걸 쓰면 표준이 된다.
 */

/**
 * **모양은 하나뿐이다.** 아웃라인 변형을 열어 뒀더니 전도금대장 하나가 배경
 * 없는 버튼이 됐고, 같은 '원본 엑셀 바로가기'가 등기내역 탭과 달라 보였다
 * (2026-08-20). 고를 수 있으면 언젠가 갈린다.
 *
 * 클래스만 필요한 자리(ListPattern 인라인 버튼)를 위해 내보낸다. 문자열을
 * 따로 두면 그게 곧 두 번째 표준이 된다 — 이 컴포넌트가 생긴 이유가 그것이다.
 * 새로 붙이는 버튼은 컴포넌트를 쓰는 편이 낫다(링크·새 탭 처리가 딸려 온다).
 */
export const HEADER_ACTION_CLASS =
  "cursor-pointer border border-vermilion bg-vermilion px-3 py-1 text-xs font-medium text-cream transition-colors hover:bg-vermilion-deep disabled:opacity-50";

type Props = {
  children: ReactNode;
  /** 주면 링크(새 탭)로 그린다. 원본 엑셀 바로가기가 그렇다. */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
};

export function HeaderActionButton({
  children,
  href,
  onClick,
  disabled,
  title,
}: Props) {
  const className = HEADER_ACTION_CLASS;

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={title}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      title={title}
    >
      {children}
    </button>
  );
}
