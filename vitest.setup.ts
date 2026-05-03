// 한국 운영부 시스템 — 시각 의존 컴포넌트(LiveClock/ShiftTimeline)가
// CI Linux(UTC) 와 로컬(KST) 모두 동일하게 KST 기준으로 렌더되도록 timezone 고정.
process.env.TZ = "Asia/Seoul";

import "@testing-library/jest-dom/vitest";
