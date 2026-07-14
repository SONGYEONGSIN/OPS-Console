/**
 * design-tokens 회귀 가드 — 핵심 토큰의 키/값을 고정한다.
 *
 * 역할:
 * - OPS Console chrome 등 새 토큰 도입 시 colors 객체에 정확한 키와 값으로 들어갔는지 보장.
 * - 기존 vermilion/washi/ink 등 핵심 키가 사라지면 즉시 알림.
 * - 컴포넌트는 Tailwind 클래스(`bg-chrome-graphite` 등)로 사용하므로 값 일치는
 *   globals.css `:root` / `@theme inline` 와의 동기화 신호이기도 하다.
 */

import { describe, expect, it } from "vitest";

import { colors } from "./design-tokens";

describe("design-tokens / colors", () => {
  it("기존 핵심 토큰을 유지한다", () => {
    expect(colors.washi).toBe("#ede6d2");
    expect(colors.cream).toBe("#faf4e6");
    expect(colors.paper).toBe("#ffffff");
    expect(colors.sidebar).toBe("#fffdf7");
    expect(colors.fieldBg).toBe("#fdfdfb");
    expect(colors.ink).toBe("#15120c");
    expect(colors.vermilion).toBe("#b8331e");
  });

  it("OPS Console chrome 토큰을 정확한 값으로 노출한다", () => {
    expect(colors.chromeGraphite).toBe("#18181b");
    expect(colors.chromeSnow).toBe("#fffdf7");
    expect(colors.chromeMuted).toBe("#71717a");
  });
});
