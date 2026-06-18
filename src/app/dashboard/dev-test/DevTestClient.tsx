"use client";

import { useActionState, useState } from "react";
import {
  setMyEntertestAccount,
  type EntertestActionState,
} from "@/features/entertest/actions";
import type { TestableService } from "@/features/entertest/queries";
import type { EntertestRun } from "@/features/entertest/schemas";
import { DevTestList } from "./DevTestList";
import { DevTestInspector } from "./DevTestInspector";

/**
 * dev-test 클라이언트 컨테이너.
 * 상단: 운영자 공통 테스트 계정 등록/수정 바.
 * 하단: 좌측 서비스 목록 + 우측 서비스별 인스펙터(2-column flex).
 */
export function DevTestClient({
  services,
  runs,
  myAccount,
}: {
  services: TestableService[];
  runs: EntertestRun[];
  myAccount: string | null;
}) {
  const [acctState, acctAction, acctPending] = useActionState<
    EntertestActionState,
    FormData
  >(setMyEntertestAccount, undefined);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selectedService =
    selectedId !== null
      ? (services.find((s) => s.service_id === selectedId) ?? null)
      : null;

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* 계정 바 — 항상 상단에 표시 */}
      <section className="border border-line bg-paper px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-ink">테스트 계정</span>
          {myAccount ? (
            <span className="text-xs text-ink-soft">
              등록된 계정:{" "}
              <span className="font-semibold text-ink">{myAccount}</span>{" "}
              (ID=PW 동일)
            </span>
          ) : (
            <span className="text-xs font-bold text-vermilion">
              테스트 계정이 등록되지 않았습니다. 본인 계정을 등록하세요.
            </span>
          )}
          <form action={acctAction} className="flex items-center gap-2">
            <input
              name="account"
              defaultValue={myAccount ?? ""}
              placeholder="jt29001"
              className="border border-line bg-cream px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
            />
            <button
              type="submit"
              disabled={acctPending}
              className="cursor-pointer border border-line bg-paper px-3 py-1 text-xs text-ink transition-colors hover:border-vermilion hover:text-vermilion disabled:opacity-50"
            >
              {myAccount ? "수정" : "등록"}
            </button>
            {acctState && (
              <span
                className={`text-2xs ${acctState.ok ? "text-ink-soft" : "text-vermilion"}`}
              >
                {acctState.message}
              </span>
            )}
          </form>
        </div>
      </section>

      {/* 2-column flex — 목록(40%) + 인스펙터(60%) */}
      <div className="flex min-h-0 gap-3">
        <div className="min-w-0" style={{ flex: "0 0 40%" }}>
          <DevTestList
            services={services}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <div className="min-w-0 flex-1">
          <DevTestInspector
            service={selectedService}
            runs={runs}
            accountReady={!!myAccount}
          />
        </div>
      </div>
    </div>
  );
}
