"use client";

import { colors } from "@/lib/design-tokens";

/**
 * Next.js 16 default `_global-error` builtin이 prerender 시 `useContext`를 null로 호출하는
 * 프레임워크 버그 우회. 우리 자체 global-error를 정의하여 builtin 대신 빌드 산출물에 포함.
 *
 * 요건 (Next.js 규약):
 *   - 'use client' 지시문
 *   - <html> + <body> 직접 포함 (root layout 대체)
 *   - reset() 호출로 ErrorBoundary 리셋 가능
 *
 * 스타일: 인라인 style 사용 — global-error는 root layout 대체라 CSS link가 로드 안 될 수 있음.
 * 색상은 design-tokens.ts에서 import (하드코딩 금지 원칙 준수).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body>
        <div
          style={{
            minHeight: "100dvh",
            display: "grid",
            placeItems: "center",
            padding: "2rem",
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, 'Pretendard Variable', 'Pretendard', sans-serif",
            background: colors.cream,
            color: colors.ink,
          }}
        >
          <div style={{ maxWidth: "32rem", textAlign: "center" }}>
            <h1
              style={{
                fontSize: "1.25rem",
                fontWeight: 600,
                marginBottom: "0.75rem",
              }}
            >
              페이지를 불러올 수 없습니다
            </h1>
            <p
              style={{
                fontSize: "0.875rem",
                color: colors.muted,
                marginBottom: "1.5rem",
              }}
            >
              일시적 오류가 발생했습니다. 다시 시도하거나 운영팀에 문의해주세요.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  border: `1px solid ${colors.ink}`,
                  background: colors.ink,
                  color: colors.cream,
                  cursor: "pointer",
                }}
              >
                다시 시도
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/";
                }}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.875rem",
                  border: `1px solid ${colors.ink}`,
                  background: "transparent",
                  color: colors.ink,
                  cursor: "pointer",
                }}
              >
                대시보드로
              </button>
            </div>
            {error.digest && (
              <p
                style={{
                  marginTop: "1.5rem",
                  fontSize: "0.75rem",
                  fontFamily:
                    "ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace",
                  color: colors.faint,
                }}
              >
                ERROR {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
