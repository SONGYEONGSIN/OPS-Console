"use client";

import { useState, useTransition } from "react";
import {
  requestDevControlSpec,
  sendDevControlSpec,
  toggleDevControlSpecItem,
} from "@/features/dev-control-specs/actions";
import type {
  DevControlSpec,
  DevControlSpecItem,
  DevControlSpecSend,
} from "@/features/dev-control-specs/schemas";
import { kstFormat } from "@/lib/kst-format";

type Recipient = {
  email: string;
  name: string;
  department: string | null;
};

const dateTime = kstFormat({
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const dateOnly = kstFormat({
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * 항목 한 줄 — 체크를 끄면 **메일에서만** 빠진다.
 *
 * 화면에서 지우지 않는 이유는, 무엇을 뺐는지 계속 보여야 다음에 다시 판단할 수
 * 있기 때문이다. 지워 버리면 재생성 때 되살아나 "분명히 뺐는데 또 나갔다"가 된다.
 */
function SpecItemRow({
  serviceId,
  item,
}: {
  serviceId: number;
  item: DevControlSpecItem;
}) {
  const [included, setIncluded] = useState(item.included);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <li className="flex items-start gap-2 py-2">
      <input
        type="checkbox"
        aria-label={`${item.title} 안내에 포함`}
        checked={included}
        onChange={(e) => {
          const next = e.target.checked;
          setIncluded(next);
          setError(null);
          startTransition(async () => {
            const r = await toggleDevControlSpecItem({
              serviceId,
              itemKey: item.key,
              included: next,
            });
            // 저장이 실패하면 화면을 되돌린다 — 껐다고 믿은 채로 발송하면 사고다.
            if (!r.ok) {
              setIncluded(!next);
              setError(r.error ?? "저장 실패");
            }
          });
        }}
        className="mt-0.5 size-3.5 accent-vermilion"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <p
          className={`text-xs font-medium ${included ? "text-ink" : "text-muted line-through"}`}
        >
          {item.title}
        </p>
        <p
          className={`text-2xs leading-relaxed ${included ? "text-muted" : "text-muted/60"}`}
        >
          {item.body}
        </p>
        {error && <p className="text-2xs text-vermilion">{error}</p>}
      </div>
    </li>
  );
}

/** 수신자 고르기 + 발송. 본문은 서버가 DB 에서 다시 만든다 — 폼을 믿지 않는다. */
function SendControl({
  serviceId,
  recipients,
  includedCount,
  lastSend,
}: {
  serviceId: number;
  recipients: Recipient[];
  includedCount: number;
  lastSend?: DevControlSpecSend;
}) {
  const [toEmail, setToEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = recipients.find((r) => r.email === toEmail);
  const canSend = Boolean(toEmail) && includedCount > 0 && !isPending;

  if (recipients.length === 0) {
    return (
      <p className="text-2xs text-muted">
        이 대학의 연락처가 없습니다 — 연락처 메뉴에 담당자를 먼저 등록해 주세요.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-2xs">
        <span className="mb-1 block text-muted">수신자</span>
        <select
          value={toEmail}
          onChange={(e) => {
            setToEmail(e.target.value);
            setDone(false);
            setError(null);
          }}
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-xs text-ink focus:border-ink focus:bg-white"
        >
          <option value="">받는 사람을 고르세요</option>
          {recipients.map((r) => (
            <option key={r.email} value={r.email}>
              {r.name}
              {r.department ? ` (${r.department})` : ""} · {r.email}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canSend}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const r = await sendDevControlSpec({
                serviceId,
                toEmail,
                toName: target?.name,
                cc: [],
              });
              if (r.ok) setDone(true);
              else setError(r.error ?? "발송 실패");
            });
          }}
          className="cursor-pointer border border-line bg-transparent px-2.5 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
        >
          발송
        </button>
        {includedCount === 0 && (
          <span className="text-2xs text-vermilion">
            포함한 항목이 없어 보낼 수 없습니다
          </span>
        )}
        {done && <span className="text-2xs text-ink">발송했습니다</span>}
      </div>

      {error && <p className="text-2xs text-vermilion">{error}</p>}
      {lastSend && (
        <p className="text-2xs text-muted">
          최근 발송 {dateTime.format(new Date(lastSend.sent_at))} ·{" "}
          {lastSend.to_email}
          {lastSend.status === "dry_run" && " (미발송 · DRY RUN)"}
          {lastSend.status === "failed" && " (실패)"}
        </p>
      )}
    </div>
  );
}

/**
 * 학교 안내용 원서제어 명세 — 개발 탭 인스펙터의 아래쪽 섹션.
 *
 * 위쪽 분석 섹션과 **독자가 다르다**: 그쪽은 운영자가 확인할 것이고, 이쪽은
 * 학교 담당자에게 나갈 문서다. 그래서 코드도 파일명도 보여주지 않는다.
 */
export function SpecSection({
  serviceId,
  spec,
  recipients,
  lastSend,
  hasAnalyses,
}: {
  serviceId?: number;
  spec?: DevControlSpec;
  recipients?: Recipient[];
  lastSend?: DevControlSpecSend;
  /** 분석이 없으면 명세를 만들 재료가 없다. */
  hasAnalyses: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [requested, setRequested] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (typeof serviceId !== "number") return null;

  const items = spec?.items ?? [];
  const includedCount = items.filter((i) => i.included).length;

  return (
    <section className="space-y-3 border-t border-line pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-ink">학교 안내용 명세</h3>
          <p className="mt-0.5 text-2xs text-muted">
            학교 담당자에게 보낼 문서입니다. 뺄 항목은 체크를 끄세요.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            disabled={!hasAnalyses || isPending || requested}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const r = await requestDevControlSpec({ serviceId });
                if (r.ok) setRequested(true);
                else setError(r.error ?? "요청 실패");
              });
            }}
            className="cursor-pointer whitespace-nowrap border border-line bg-transparent px-2.5 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-50"
          >
            {spec ? "다시 만들기" : "명세서 만들기"}
          </button>
          {requested && (
            <span className="text-2xs text-muted">
              요청했습니다 — 5분 이내에 만들어집니다
            </span>
          )}
        </div>
      </div>

      {error && <p className="text-2xs text-vermilion">{error}</p>}

      {!hasAnalyses && (
        <p className="text-2xs text-muted">
          먼저 [지금 분석]으로 원서제어를 수집해 주세요.
        </p>
      )}

      {spec && items.length > 0 && (
        <>
          {spec.source_analyzed_at && (
            <p className="text-2xs text-muted">
              {dateOnly.format(new Date(spec.source_analyzed_at))} 기준 코드로
              만들었습니다. 최신이 필요하면 [지금 분석] 후 다시 만드세요.
            </p>
          )}
          <ul className="divide-y divide-line-soft">
            {items.map((item) => (
              <SpecItemRow key={item.key} serviceId={serviceId} item={item} />
            ))}
          </ul>
          <p className="text-2xs text-muted">
            {items.length}건 중 {includedCount}건이 나갑니다.
          </p>
          <SendControl
            serviceId={serviceId}
            recipients={recipients ?? []}
            includedCount={includedCount}
            lastSend={lastSend}
          />
        </>
      )}

      {hasAnalyses && !spec && (
        <p className="text-2xs text-muted">
          아직 만들지 않았습니다. [명세서 만들기]를 눌러 주세요.
        </p>
      )}
    </section>
  );
}
