import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TodayTimeline } from "../TodayTimeline";
import type { TimelineEvent } from "../timeline-points";

const events: TimelineEvent[] = [
  { id: "m1", label: "독려발송", kind: "mail", at: "10:30" },
  { id: "s1", label: "당직 교대", kind: "sch", at: "12:00" },
  { id: "d1", label: "D-0 마감", kind: "due", at: "18:00" },
];

describe("TodayTimeline", () => {
  it("'오늘의 흐름' 헤더 렌더", () => {
    const { getByText } = render(
      <TodayTimeline events={events} nowIso="2026-06-11T15:00:00+09:00" />,
    );
    expect(getByText(/오늘의 흐름/)).toBeTruthy();
  });

  it("이벤트 개수만큼 점(data-kind)을 렌더", () => {
    const { container } = render(
      <TodayTimeline events={events} nowIso="2026-06-11T15:00:00+09:00" />,
    );
    expect(container.querySelectorAll("[data-timeline-point]")).toHaveLength(3);
  });

  it("kind별 색 토큰 클래스 적용 (due=vermilion, mail=sage, sch=indigo)", () => {
    const { container } = render(
      <TodayTimeline events={events} nowIso="2026-06-11T15:00:00+09:00" />,
    );
    const due = container.querySelector('[data-kind="due"]');
    const mail = container.querySelector('[data-kind="mail"]');
    const sch = container.querySelector('[data-kind="sch"]');
    expect(due?.getAttribute("class") ?? "").toMatch(/bg-vermilion/);
    expect(mail?.getAttribute("class") ?? "").toMatch(/bg-sage/);
    expect(sch?.getAttribute("class") ?? "").toMatch(/bg-indigo/);
  });

  it("NOW 마커를 렌더하고 nowPct를 left 인라인 스타일로 배치", () => {
    const { container } = render(
      <TodayTimeline events={events} nowIso="2026-06-11T13:30:00+09:00" />,
    );
    const now = container.querySelector("[data-timeline-now]");
    expect(now).toBeTruthy();
    // 13:30 → 50%
    expect((now as HTMLElement)?.style.left).toBe("50%");
  });

  it("점 라벨을 렌더", () => {
    const { getByText } = render(
      <TodayTimeline events={events} nowIso="2026-06-11T15:00:00+09:00" />,
    );
    expect(getByText("독려발송")).toBeTruthy();
    expect(getByText("D-0 마감")).toBeTruthy();
  });

  it("축 틱 라벨(09/12/15/18)을 렌더", () => {
    const { getByText } = render(
      <TodayTimeline events={[]} nowIso="2026-06-11T15:00:00+09:00" />,
    );
    expect(getByText("09:00")).toBeTruthy();
    expect(getByText("18:00")).toBeTruthy();
  });
});
