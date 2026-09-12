"use client";

import { useActionState, type ReactNode } from "react";
import type { ViewProps } from "../types";
import { Section, DefList, Divider } from "../shared";
import {
  AI_TOOL_LABEL,
  AI_TOOL_TONE,
  CATEGORY_LABEL,
  CATEGORY_TONE,
} from "@/lib/ai-work/constants";
import type { AiTool, AiWorkCategory } from "@/features/ai-work/schemas";
import { kstFormat } from "@/lib/kst-format";
import {
  promoteCandidateAction,
  hideCandidateAction,
  unhideCandidateAction,
  type CandidateActionState,
} from "@/features/ai-tip-candidates/actions";

/** 수집일 — 날짜만. 시각까지는 후보를 훑는 데 짐만 된다(표와 같은 셈). */
const COLLECTED_DATE = kstFormat({
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatCollectedAt(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  // 화면에 `Invalid Date` 를 흘리지 않는다.
  if (Number.isNaN(d.getTime())) return "—";
  return COLLECTED_DATE.format(d);
}

/**
 * 어느 버튼을 눌렀는지는 **submit 버튼의 `name`/`value`** 로 온다.
 *
 * 폼(과 `useActionState`)을 버튼 수만큼 두지 않는 이유: 상태가 갈리면 등록에
 * 실패한 메시지가 그 뒤 숨김이 성공한 화면에도 그대로 남는다. 한 상태로 묶으면
 * 마지막에 누른 결과만 남는다.
 */
async function decideCandidateAction(
  prev: CandidateActionState,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const intent = formData.get("intent");
  if (intent === "promote") return promoteCandidateAction(prev, formData);
  if (intent === "hide") return hideCandidateAction(prev, formData);
  return unhideCandidateAction(prev, formData);
}

const decideButtonClass =
  "flex-1 cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-default disabled:opacity-50";

/** 초안이 비었다는 사실을 그대로 말한다 — 빈칸은 왜 비었는지 알려주지 않는다. */
function DraftMissing({ what }: { what: string }) {
  return <span className="text-2xs text-muted">초안 없음 — {what}</span>;
}

/**
 * TIP 후보 인스펙터 읽기 화면.
 *
 * **DB 에 있는 칸만 그린다.** 언어·최근 업데이트·'사용 시점/사용 방법' 은
 * `ai_tip_candidates` 에 컬럼이 없다. 자리를 만들어 `-` 로 채우면 값이 있는데
 * 비어 보이는 것과 구분이 안 된다.
 */
export function AiTipCandidateView({ row }: ViewProps) {
  const [state, formAction, pending] = useActionState<
    CandidateActionState,
    FormData
  >(decideCandidateAction, undefined);

  const reviewStatus = row.tipCandidateStatus ?? "pending";
  // `readOnly` 는 ListPattern 의 편집 모드만 막는다 — 결정 버튼은 View 가 직접 가린다.
  const canDecide = row.tipCandidateCanDecide === true;

  const tool = row.aiTool as AiTool | undefined;
  const cat = row.category as AiWorkCategory | undefined;
  const repoUrl = row.tipCandidateRepoUrl;

  const items: { term: string; desc: ReactNode }[] = [
    {
      term: "리포지터리",
      desc: (
        <span className="text-ink">{row.tipCandidateRepoFullName ?? "—"}</span>
      ),
    },
    {
      term: "리포 설명",
      desc: row.tipCandidateRepoDescription ? (
        <span className="text-ink">{row.tipCandidateRepoDescription}</span>
      ) : (
        <span className="text-muted">—</span>
      ),
    },
    {
      term: "별",
      desc: (
        <span className="text-ink">
          {/* 별은 세는 값이라 tabular-nums — font-mono 는 식별자 전용. */}
          <span className="tabular-nums">{row.tipCandidateStars ?? 0}</span>
          {/*
            수집 당시 스냅샷이고 재수집으로 갱신되지 않는다. 라벨 없이 숫자만
            두면 지금 별로 읽혀, 반년 전 값을 오늘 인기로 착각한다.
          */}
          <span className="ml-1.5 text-2xs text-muted">— 수집 시점 값</span>
        </span>
      ),
    },
    {
      term: "수집일",
      desc: (
        <span className="tabular-nums text-ink">
          {formatCollectedAt(row.tipCandidateCollectedAt)}
        </span>
      ),
    },
    {
      term: "AI 도구",
      desc: tool ? (
        <span
          className={`inline-block px-2 py-0.5 text-2xs ${AI_TOOL_TONE[tool] ?? ""}`}
        >
          {AI_TOOL_LABEL[tool] ?? tool}
        </span>
      ) : (
        <DraftMissing what="등록 후 직접 지정" />
      ),
    },
    {
      term: "카테고리",
      desc: cat ? (
        <span
          className={`inline-block px-2 py-0.5 text-2xs ${CATEGORY_TONE[cat] ?? ""}`}
        >
          {CATEGORY_LABEL[cat] ?? cat}
        </span>
      ) : (
        <DraftMissing what="등록 후 직접 지정" />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Section title="후보 정보">
        <DefList items={items} />
        {repoUrl && (
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block cursor-pointer border border-line bg-transparent px-3 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
          >
            레포로 이동
          </a>
        )}
      </Section>

      <Divider />

      <Section title="요약">
        {row.summary ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {row.summary}
          </p>
        ) : (
          <DraftMissing what="등록 후 직접 작성" />
        )}
      </Section>

      <Divider />

      <Section title="재사용 프롬프트">
        {row.reusePrompt ? (
          <pre className="whitespace-pre-wrap break-words border border-line bg-washi-raised px-3 py-2 text-xs leading-relaxed text-ink">
            {row.reusePrompt}
          </pre>
        ) : (
          <DraftMissing what="등록 후 직접 작성" />
        )}
      </Section>

      <Divider />

      <Section title="검토">
        <DecideBody
          id={row.id}
          reviewStatus={reviewStatus}
          canDecide={canDecide}
          formAction={formAction}
          pending={pending}
          state={state}
        />
      </Section>

      {row.tags && row.tags.length > 0 && (
        <>
          <Divider />
          <Section title="태그">
            <div className="flex flex-wrap gap-1.5">
              {row.tags.map((t) => (
                <span
                  key={t}
                  className="inline-block bg-line-soft px-2 py-0.5 text-2xs text-ink-soft"
                >
                  {t}
                </span>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function DecideBody({
  id,
  reviewStatus,
  canDecide,
  formAction,
  pending,
  state,
}: {
  id: string;
  reviewStatus: NonNullable<ViewProps["row"]["tipCandidateStatus"]>;
  canDecide: boolean;
  formAction: (formData: FormData) => void;
  pending: boolean;
  state: CandidateActionState;
}) {
  // 등록된 후보는 권한과 무관하게 되돌릴 자리가 없다 — TIP 은 이미 만들어졌다.
  if (reviewStatus === "promoted")
    return (
      <p className="text-xs text-muted">
        이미 TIP 으로 등록한 후보입니다. 내용은 등록된 TIP 에서 고칩니다.
      </p>
    );

  if (!canDecide)
    return (
      <p className="text-xs text-muted">
        TIP 등록·숨김 권한이 없습니다. 보기만 가능합니다.
      </p>
    );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="id" value={id} />

      {reviewStatus === "hidden" ? (
        <>
          <p className="text-xs text-muted">
            숨긴 후보입니다. 수집기가 숨긴 리포를 다시 가져오지 않으므로,
            되돌리지 않으면 목록에 다시 나타나지 않습니다.
          </p>
          <button
            type="submit"
            name="intent"
            value="unhide"
            disabled={pending}
            className={decideButtonClass}
          >
            되돌리기
          </button>
        </>
      ) : (
        <>
          <div className="flex gap-2">
            <button
              type="submit"
              name="intent"
              value="promote"
              disabled={pending}
              className={decideButtonClass}
            >
              TIP 등록
            </button>
            <button
              type="submit"
              name="intent"
              value="hide"
              disabled={pending}
              className={decideButtonClass}
            >
              숨김
            </button>
          </div>
          {/* 숨김이 영구 삭제로 보이면 아무도 못 누른다 — 되돌릴 수 있음을 먼저 말한다. */}
          <p className="text-xs text-muted">
            숨겨도 숨김 탭에서 되돌릴 수 있습니다.
          </p>
        </>
      )}

      {state ? (
        <p className={`text-xs ${state.ok ? "text-ink" : "text-vermilion"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
