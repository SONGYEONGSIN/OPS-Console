import { describe, it, expect } from "vitest";
import { parseProposalResponse } from "../parse-response";

/**
 * 에이전트 응답을 **믿지 않고 읽는다**(§6.3).
 *
 * **던지지 않는다.** 폴러가 `failed` 로 회신해야 하는데 여기서 던지면 그 경로가
 * 예외로 끊기고, 관리자 화면에는 '판정 중' 이 영원히 남는다.
 *
 * 모르는 대학은 제약 위반이 아니라 **환각**이라 게이트가 아니라 여기서 떨군다
 * (§6.1) — 후보 목록에 없는 대학은 애초에 옮길 수 있는 것이 아니었다.
 */
const CANDIDATES = [
  { university_name: "가대", work_kind: "원서접수" },
  { university_name: "나대", work_kind: "PIMS" },
];

const line = (o: Record<string, unknown> = {}) => ({
  university_name: "가대",
  work_kind: "원서접수",
  prev_assignee: "a@x.com",
  next_assignee: "b@x.com",
  reason: "2그룹 평균보다 4곳 많다",
  ...o,
});

const raw = (moves: unknown[]) => JSON.stringify({ moves });

describe("parseProposalResponse", () => {
  it("이동 목록을 읽는다", () => {
    const r = parseProposalResponse(raw([line()]), CANDIDATES);

    expect(r).toEqual({
      ok: true,
      moves: [
        {
          university_name: "가대",
          work_kind: "원서접수",
          prev_assignee: "a@x.com",
          next_assignee: "b@x.com",
          reason: "2그룹 평균보다 4곳 많다",
        },
      ],
    });
  });

  it("빈 이동 목록도 정상이다 — 옮길 것이 없다는 답은 옳은 답이다", () => {
    expect(parseProposalResponse(raw([]), CANDIDATES)).toEqual({
      ok: true,
      moves: [],
    });
  });

  it("JSON 이 아니면 거부한다 — 던지지 않는다", () => {
    const r = parseProposalResponse("미안하지만 못 하겠습니다", CANDIDATES);

    expect(r.ok).toBe(false);
    expect(r).toMatchObject({ error: expect.stringMatching(/JSON/) });
  });

  it("코드펜스로 감싸 와도 읽는다 — 그 창구가 늘 그렇게 준다", () => {
    // 폴백이 아니라 경로의 모양이다. 못 읽으면 판정이 통째로 죽는다.
    const r = parseProposalResponse(
      "```json\n" + raw([line()]) + "\n```",
      CANDIDATES,
    );

    expect(r.ok).toBe(true);
  });

  it("moves 가 없으면 거부한다", () => {
    const r = parseProposalResponse(JSON.stringify({ result: [] }), CANDIDATES);

    expect(r).toMatchObject({
      ok: false,
      error: expect.stringMatching(/moves/),
    });
  });

  it("칸이 빠지면 어느 칸인지 말한다", () => {
    const { reason: _drop, ...noReason } = line();
    const r = parseProposalResponse(raw([noReason]), CANDIDATES);

    expect(r).toMatchObject({
      ok: false,
      error: expect.stringMatching(/reason/),
    });
  });

  it("후보에 없는 대학은 거부한다 — 환각이다", () => {
    const r = parseProposalResponse(
      raw([line({ university_name: "없는대" })]),
      CANDIDATES,
    );

    expect(r).toMatchObject({
      ok: false,
      error: expect.stringMatching(/없는대/),
    });
  });

  it("후보에 있는 대학이라도 업무종류가 다르면 거부한다", () => {
    // 후보는 (대학 × 업무종류)다. 가대의 PIMS 는 옮길 수 있는 것이 아니었다.
    const r = parseProposalResponse(
      raw([line({ work_kind: "PIMS" })]),
      CANDIDATES,
    );

    expect(r).toMatchObject({
      ok: false,
      error: expect.stringMatching(/가대/),
    });
  });

  it("같은 칸을 두 번 말하면서 답이 다르면 거부한다", () => {
    // 하위유형마다 한 줄씩 줄 수 있는데, 서로 다른 사람을 말하면 그게 분할이다.
    const r = parseProposalResponse(
      raw([line(), line({ next_assignee: "c@x.com" })]),
      CANDIDATES,
    );

    expect(r).toMatchObject({
      ok: false,
      error: expect.stringMatching(/가대.*원서접수/),
    });
  });

  it("같은 칸을 같은 답으로 두 번 말하면 한 줄로 합친다", () => {
    const r = parseProposalResponse(raw([line(), line()]), CANDIDATES);

    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.moves).toHaveLength(1);
  });

  it("이전 담당자가 비어 있어도 읽는다 — 거부는 게이트의 일이다", () => {
    // 여기서 막으면 '왜 떨어졌는지' 가 보고에 안 남는다. G2·G3 가 이유를 달아 떨군다.
    const r = parseProposalResponse(
      raw([line({ prev_assignee: null })]),
      CANDIDATES,
    );

    expect(r).toMatchObject({ ok: true });
  });

  it("근거가 공백뿐이면 빈 문자열로 넘긴다 — 떨구는 것은 G7 이다", () => {
    // 여기서 막으면 '근거를 안 썼다' 는 이유가 보고에 안 남고 응답 전체가 실패로 보인다.
    const r = parseProposalResponse(raw([line({ reason: "   " })]), CANDIDATES);

    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.moves[0].reason).toBe("");
  });
});
