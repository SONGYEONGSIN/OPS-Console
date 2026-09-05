import { describe, it, expect } from "vitest";
import { mergeFileItems } from "../lib/dev-control-lib.mjs";

/**
 * 파일별 산출을 하나로 합친다.
 *
 * **한 번에 다 넣으면 대부분이 사라진다** — 실측(service 1130058):
 *   A.js 단독 18KB(JX.IF 44개) → 56항목
 *   9파일 87KB(JX.IF 83개) 합쳐서 → 74항목
 * 파일 하나가 56개를 내놓는데 아홉을 합치면 74개다. 뭉개진 것이다.
 */
describe("mergeFileItems", () => {
  it("파일별 항목을 모두 담는다", () => {
    const r = mergeFileItems([
      [{ key: "a:1", title: "A", body: "b" }],
      [{ key: "b:1", title: "B", body: "b" }],
    ]);
    expect(r).toHaveLength(2);
  });

  /** 같은 제어가 두 파일에 걸쳐 있으면 한 번만 싣는다 — 문서에 같은 줄이 두 번 나오면 안 된다. */
  it("같은 key 는 한 번만 — 먼저 온 것을 쓴다", () => {
    const r = mergeFileItems([
      [{ key: "a:1", title: "먼저", body: "b" }],
      [{ key: "a:1", title: "나중", body: "b" }],
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].title).toBe("먼저");
  });

  it("파일 순서를 지킨다 — 매번 순서가 바뀌면 대조가 어렵다", () => {
    const r = mergeFileItems([
      [{ key: "a:1", title: "A", body: "b" }],
      [{ key: "b:1", title: "B", body: "b" }],
      [{ key: "c:1", title: "C", body: "b" }],
    ]);
    expect(r.map((i) => i.key)).toEqual(["a:1", "b:1", "c:1"]);
  });

  /** 한 파일이 실패해도 나머지는 살린다 — 전부 버리면 9번 중 1번 실패에 문서가 통째로 없다. */
  it("빈 결과가 섞여 있어도 나머지를 살린다", () => {
    const r = mergeFileItems([
      [{ key: "a:1", title: "A", body: "b" }],
      [],
      null,
      [{ key: "b:1", title: "B", body: "b" }],
    ]);
    expect(r.map((i) => i.key)).toEqual(["a:1", "b:1"]);
  });

  it("key 가 빈 항목은 버린다 — 제외 결정을 걸 수 없다", () => {
    const r = mergeFileItems([
      [
        { key: "", title: "A", body: "b" },
        { key: "a:1", title: "B", body: "b" },
      ],
    ]);
    expect(r.map((i) => i.key)).toEqual(["a:1"]);
  });

  it("아무것도 없으면 빈 배열", () => {
    expect(mergeFileItems([])).toEqual([]);
  });
});

/**
 * 큰 파일부터 돌린다.
 *
 * 실측: 가장 큰 파일(18,484자)이 per-file 제한에 두 번 걸려 죽었다 — 그 파일이
 * 단독으로 60항목을 내놓는 **제어가 제일 많은 파일**이라 빠지면 손실이 크다.
 * 큰 것부터 시작하면 (1) 긴 활주로를 먼저 받고 (2) 예산이 모자랄 때 빠지는 쪽이
 * 작은 파일이 된다. 작업 스케줄링의 LPT 와 같은 이유다.
 */
describe("bySizeDesc", () => {
  it("큰 파일이 먼저 온다", async () => {
    const { bySizeDesc } = await import("../lib/dev-control-lib.mjs");
    const r = bySizeDesc([
      { raw_code: "ab" },
      { raw_code: "abcd" },
      { raw_code: "a" },
    ]);
    expect(r.map((f) => f.raw_code.length)).toEqual([4, 2, 1]);
  });

  it("원본 배열을 바꾸지 않는다", async () => {
    const { bySizeDesc } = await import("../lib/dev-control-lib.mjs");
    const src = [{ raw_code: "a" }, { raw_code: "abc" }];
    bySizeDesc(src);
    expect(src[0].raw_code).toBe("a");
  });
});
