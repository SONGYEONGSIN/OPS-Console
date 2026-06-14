import {
  type ActivityLogEntry,
  type ActivityTone,
  kstClock,
  kstDateYmd,
  isInWindow,
} from "./activity-log";

/** 타임라인 이벤트 원천 1건 — 도메인별로 page.tsx에서 적절한 시각(atIso)으로 매핑. */
export type TimelineSource = {
  id: string;
  /** 이벤트 기준 시각(ISO). 서비스=오픈/마감 시각, 그 외=등록(created_at). */
  atIso: string;
  /** 표시용 도메인 라벨 (서비스/마감/할일/자동화/백업/인수인계/사고/공지/개선). */
  domain: string;
  text: string;
  tone: ActivityTone;
};

/**
 * 9개 도메인 원천 → 타임라인 엔트리.
 * 오늘(KST todayYmd) + 업무시간(09:00–18:00) 건만 시각 위치를 계산해 남긴다.
 * 군집 솎음(min-gap)은 ActivityTimeline의 selectTimelineEvents가 담당.
 */
export function buildTimelineEvents(
  sources: TimelineSource[],
  todayYmd: string,
): ActivityLogEntry[] {
  const out: ActivityLogEntry[] = [];
  for (const s of sources) {
    if (!s.atIso) continue;
    if (kstDateYmd(s.atIso) !== todayYmd) continue;
    const { hms, minutesOfDay } = kstClock(s.atIso);
    if (!isInWindow(minutesOfDay)) continue;
    out.push({
      id: s.id,
      atIso: s.atIso,
      hms,
      minutesOfDay,
      domain: s.domain,
      text: s.text,
      tone: s.tone,
    });
  }
  return out;
}
