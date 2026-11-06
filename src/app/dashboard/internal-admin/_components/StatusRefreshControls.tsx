"use client";

import { useState, useTransition } from "react";
import { HeaderActionButton } from "@/components/common/HeaderActionButton";
import { requestStatusRefresh } from "@/features/sms-sender/status-refresh/actions";
import type { StatusRefreshView } from "@/features/sms-sender/status-refresh/contract";
import { RefreshHistoryModal } from "./RefreshHistoryModal";

const CONFIRM =
  "현황 최신화를 요청할까요?\n회사 PC 가 Moa 에 로그인하므로 인증 문자가 1통 갑니다.";
const THROWN = "요청에 실패했습니다. 잠시 뒤 다시 시도하세요.";

/**
 * SourceBar 안의 `현황 최신화`·`최신화 이력` 버튼.
 *
 * 최신화 버튼은 admin·SMS 발신번호 등록 담당자에게만 보이고(서버 action 이 다시 본다),
 * 진행 중이면 같은 자리에 비활성 `최신화 진행 중` 이 선다. 이력은 메뉴를 볼 수 있으면 누구나.
 * 진행 상태는 화면을 다시 읽을 때 갱신된다(폴링 없음).
 */
export function StatusRefreshControls({ view }: { view: StatusRefreshView }) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  function request() {
    if (!window.confirm(CONFIRM)) return;
    setNotice(null);
    setError(null);
    startTransition(async () => {
      // 던진 채로 두면 React 19 가 오류 경계로 올려 페이지 전체가 오류 화면이 된다.
      try {
        const result = await requestStatusRefresh();
        if (result.ok) setNotice(result.message);
        else setError(result.error);
      } catch {
        setError(THROWN);
      }
    });
  }

  return (
    <>
      {view.canRequest &&
        (view.active ? (
          <HeaderActionButton disabled>최신화 진행 중</HeaderActionButton>
        ) : (
          <HeaderActionButton disabled={pending} onClick={request}>
            현황 최신화
          </HeaderActionButton>
        ))}
      <HeaderActionButton onClick={() => setShowHistory(true)}>
        최신화 이력
      </HeaderActionButton>
      {/* 버튼 사이에 끼지 않게 문구는 줄 끝으로 보낸다. */}
      {notice && (
        <span role="status" className="order-last text-xs text-ink-soft">
          {notice}
        </span>
      )}
      {error && (
        <span role="alert" className="order-last text-xs text-vermilion">
          {error}
        </span>
      )}
      {showHistory && (
        <RefreshHistoryModal
          items={view.history}
          loadError={view.loadError}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}
