import { describe, it, expect } from "vitest";
import { topFromRegions } from "../receipt-direction";

// 운영 영수증(바로 섬) 하나의 실측 상자 — 3024x4032, 접수일자 위·총요금 아래.
const DATE = [0.3, 0.2, 0.5, 0.22] as [number, number, number, number];
const FEE = [0.5, 0.63, 0.7, 0.65] as [number, number, number, number];

/** 사진을 시계 방향으로 90° 돌린 좌표 — (x, y) → (1 - y, x) */
const cw = ([x0, y0, x1, y1]: [number, number, number, number]) =>
  [1 - y1, x0, 1 - y0, x1] as [number, number, number, number];
const flip = ([x0, y0, x1, y1]: [number, number, number, number]) =>
  [1 - x1, 1 - y1, 1 - x0, 1 - y0] as [number, number, number, number];

describe("topFromRegions — 접수일자에서 총요금으로 가는 쪽이 영수증의 아래다", () => {
  it("바로 선 영수증은 top", () => {
    expect(
      topFromRegions(
        { receipt: null, accepted_at: DATE, total_fee: FEE },
        3024,
        4032,
      ),
    ).toBe("top");
  });

  it("거꾸로면 bottom", () => {
    expect(
      topFromRegions(
        { receipt: null, accepted_at: flip(DATE), total_fee: flip(FEE) },
        3024,
        4032,
      ),
    ).toBe("bottom");
  });

  it("시계 방향으로 누우면 맨 위가 오른쪽 — right", () => {
    expect(
      topFromRegions(
        { receipt: null, accepted_at: cw(DATE), total_fee: cw(FEE) },
        4032,
        3024,
      ),
    ).toBe("right");
  });

  it("반시계로 누우면 left", () => {
    const ccw = (b: [number, number, number, number]) => cw(flip(b));
    expect(
      topFromRegions(
        { receipt: null, accepted_at: ccw(DATE), total_fee: ccw(FEE) },
        4032,
        3024,
      ),
    ).toBe("left");
  });

  it("가로·세로 차이가 1.5배가 안 되면 모른다(null) — 누운 사진의 흐트러진 상자", () => {
    // #04 옛 판독 실측: dx≈564px, dy≈590px
    expect(
      topFromRegions(
        {
          receipt: null,
          accepted_at: [0.4, 0.4, 0.5, 0.42],
          total_fee: [0.54, 0.6, 0.64, 0.62],
        },
        4032,
        3024,
      ),
    ).toBeNull();
  });

  it("1.5배가 경계다 — 1.49배는 모르고 1.5배는 방향", () => {
    // 1000x1000 사진, 가로 100px 이동에 세로 149px·150px
    const at = (dy: number) =>
      topFromRegions(
        {
          receipt: null,
          accepted_at: [0, 0, 0, 0],
          total_fee: [0.1, dy, 0.1, dy],
        },
        1000,
        1000,
      );
    expect(at(0.149)).toBeNull();
    expect(at(0.15)).toBe("top");
  });

  it("상자가 없으면 null", () => {
    expect(topFromRegions(null, 3024, 4032)).toBeNull();
    expect(
      topFromRegions(
        { receipt: null, accepted_at: DATE, total_fee: null },
        3024,
        4032,
      ),
    ).toBeNull();
  });
});
