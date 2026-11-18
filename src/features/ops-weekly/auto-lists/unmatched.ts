import type { ClosingLite } from "./application";
import type { PimsLite } from "./pims";

/** 담당자 이름이 작성 대상 누구와도 맞지 않아 어느 보고서에도 안 들어간 서비스 — 설정 탭이 보여 준다. */
export type UnmatchedServices = {
  application: ClosingLite[];
  pims: PimsLite[];
};

export const NO_UNMATCHED: UnmatchedServices = { application: [], pims: [] };
