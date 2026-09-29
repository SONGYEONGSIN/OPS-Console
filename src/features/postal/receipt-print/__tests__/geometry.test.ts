import { describe, it, expect } from "vitest";
import { cropRect, markRect } from "../geometry";
import type { Box } from "../../extract-parse";

const W = 1000;
const H = 2000;
const FULL = { left: 0, top: 0, width: W, height: H };

describe("cropRect — 잘라낼 영역", () => {
  it("상자가 없으면 사진 전체 — 자르지 않고 칸에 맞춘다", () => {
    expect(cropRect(null, W, H)).toEqual(FULL);
  });

  it("종이 상자에 사방 2%(사진 폭·높이 기준) 여유를 둔다", () => {
    expect(cropRect([0.2, 0.1, 0.8, 0.9], W, H)).toEqual({
      left: 180,
      top: 160,
      width: 640,
      height: 1680,
    });
  });

  it("사진 밖으로 나가는 여유는 경계에서 자른다", () => {
    expect(cropRect([0, 0, 1, 1], W, H)).toEqual(FULL);
    expect(cropRect([0.1, 0, 0.9, 1], W, H)).toEqual({
      left: 80,
      top: 0,
      width: 840,
      height: 2000,
    });
  });
});

describe("markRect — 형광펜 자리", () => {
  // 300~500 × 200~240px, 높이 40 → 여유 10
  const box: Box = [0.3, 0.1, 0.5, 0.12];

  it("상자 높이의 25% 여유를 두고 줄인 배율을 곱한다", () => {
    const m = markRect(box, FULL, W, H, 0.5);
    expect(m?.left).toBeCloseTo(145);
    expect(m?.top).toBeCloseTo(95);
    expect(m?.width).toBeCloseTo(110);
    expect(m?.height).toBeCloseTo(30);
    expect(m?.radius).toBeCloseTo(5);
  });

  it("잘라낸 영역 기준으로 옮긴다", () => {
    const m = markRect(
      box,
      { left: 100, top: 150, width: 800, height: 1800 },
      W,
      H,
      1,
    );
    expect(m?.left).toBeCloseTo(190);
    expect(m?.top).toBeCloseTo(40);
    expect(m?.width).toBeCloseTo(220);
    expect(m?.height).toBeCloseTo(60);
  });

  it("잘라낸 영역 밖으로 나간 부분은 버린다", () => {
    const m = markRect(
      box,
      { left: 350, top: 0, width: 650, height: 2000 },
      W,
      H,
      1,
    );
    expect(m?.left).toBeCloseTo(0);
    expect(m?.width).toBeCloseTo(160);
  });

  it("통째로 밖이면 칠하지 않는다 — 오류로 멈추지 않는다", () => {
    const outside = { left: 500, top: 0, width: 500, height: 2000 };
    expect(markRect([0.1, 0.1, 0.2, 0.12], outside, W, H, 1)).toBeNull();
  });

  it("linesAbove 만큼 위로 더 덮는다 — 여유는 원래 상자 높이 기준(총요금 두 줄 폭)", () => {
    // 200~240px(높이 40) → 한 줄 위 160, 여유 10 → 150~250
    const m = markRect(box, FULL, W, H, 1, 1);
    expect(m?.top).toBeCloseTo(150);
    expect(m?.height).toBeCloseTo(100);
    expect(m?.left).toBeCloseTo(290);
    expect(m?.width).toBeCloseTo(220);
    expect(m?.radius).toBeCloseTo(10);
  });

  it("위로 넓혀도 잘라낸 영역 위로는 안 나간다", () => {
    // 20~60px → 한 줄 위 −20, 여유 10 → 0 에서 멈춘다. 아래는 60 + 10
    const m = markRect([0.3, 0.01, 0.5, 0.03], FULL, W, H, 1, 1);
    expect(m?.top).toBeCloseTo(0);
    expect(m?.height).toBeCloseTo(70);
  });
});
