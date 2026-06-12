"use client";

import { useState } from "react";
import { LiveIndicator } from "../LiveIndicator";
import {
  HealthGateway,
  HealthDetailList,
  type HealthGatewayItem,
} from "./HealthGateway";
import LogTicker from "./LogTicker";
import type { ConsoleLogEntry } from "../mock-log-pool";

/**
 * LiveStatusBar — 상단 고정 status line (한 줄).
 *  [시스템 헬스(LED)] · [실시간 로그 티커(가운데 채움)] · [▾상세] · [●LIVE]
 *
 * 시스템 현황과 로그 티커를 한 줄로 합쳐 화면 상단에 sticky로 상주한다.
 * 티커는 LED 클러스터와 상세/LIVE 사이 빈 공간(flex-1)을 채우며 가로로 흐른다.
 * ▾상세 토글 시 7개 항목 상세를 아래로 펼친다. 좌우 여백은 본문과 동일한 max-w·px-6.
 * 데이터는 LiveOverview가 내려준다.
 */
export function LiveStatusBar({
  healthItems,
  logLines,
}: {
  healthItems: HealthGatewayItem[];
  logLines: ConsoleLogEntry[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-20 bg-paper">
      <div className="px-6">
        <div className="mx-auto max-w-[1680px] border-b-2 border-line">
          <div className="flex items-center gap-3 py-[7px]">
            <HealthGateway items={healthItems} />
            <div className="min-w-0 flex-1">
              <LogTicker lines={logLines} />
            </div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="shrink-0 cursor-pointer text-sm font-bold text-ink-soft transition-colors hover:text-vermilion"
            >
              {open ? "닫기" : "상세"}
              <span aria-hidden className="ml-1 text-vermilion">
                {open ? "▲" : "▼"}
              </span>
            </button>
            <div className="flex shrink-0 items-center border-l border-line-soft pl-3">
              <LiveIndicator label="LIVE" />
            </div>
          </div>
          {open ? <HealthDetailList items={healthItems} /> : null}
        </div>
      </div>
    </div>
  );
}
