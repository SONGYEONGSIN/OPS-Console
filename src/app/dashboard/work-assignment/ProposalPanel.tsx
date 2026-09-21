import { Fragment } from "react";
import { kstFormat } from "@/lib/kst-format";
import {
  TENURE_GROUP_LABELS,
  type TenureGroup,
} from "@/features/assignments/tenure";
import type {
  ProposalBatchRow,
  ProposalRow,
} from "@/features/assignments/proposal/queries";
import { ProposalDecision } from "./ProposalDecision";

/**
 * 제안 탭 — **관리자가 마지막 승인을 하는 자리**(설계 §9.3 · rev 2).
 *
 * 여기서 가장 중요한 것은 **제안이 아직 사실이 아니라는 사실이 보이는 것**이다(§5.4).
 * 표가 확정처럼 보이면 관리자는 확인 없이 넘기고, 반려가 기본 선택지라는 구조(R4)가
 * 무너진다.
 *
 * 근거도 함께 편다 — '에이전트가 관리하는 모든 사항을 확인할 수 있어야 한다' 는
 * 요구(사용자)가 `basis` 펼침으로 충족된다. 그룹 목표·상한·**게이트가 떨군 줄**까지다:
 * 통과만 보이면 '에이전트가 1건만 제안했다' 로 읽고 모델이 멍청하다고 결론 낸다(F11).
 *
 * 서버 컴포넌트다. 데이터는 페이지가 한 번 읽어 넘긴다 — 여기서 따로 읽으면 머리
 * 건수와 목록이 다른 시점을 본다.
 */

const kstDateTime = kstFormat({
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * 네 칸. **`근거` 는 열이 아니다** — 열로 두면 화면 절반을 먹어 나머지가 짜부라지고
 * `김슬기` 가 `김슬 / 기` 로 갈렸다(실측 2026-09-21). 제 줄을 준다.
 *
 * `이전`·`제안` 도 한 칸이다 — 둘은 따로 읽는 값이 아니라 **하나의 이동**이고,
 * 화살표가 그것을 말한다.
 */
const COLUMNS = ["대학", "업무종류", "하위유형", "이동"] as const;

/**
 * 이동 한 건 = **(대학 × 업무종류 × 이전 → 제안)**. 하위유형은 그 안에 모인다.
 *
 * 설계가 정한 이동 단위가 (대학 × 업무종류)인데(rev 4) 제안 **행**은 원장 한 줄이라
 * 하위유형마다 하나다. 그대로 세우면 이전→제안도 근거도 **글자까지 같은 줄이 두 벌**
 * 생기고, 읽는 사람은 다른 줄인 줄 안다 — 24건이 12건의 두 벌이었다.
 *
 * 순수 함수로 둬서 접는 규칙에 시험이 붙는다.
 */
export function foldMoves(
  rows: ProposalRow[],
): {
  key: string;
  university_name: string;
  work_kind: string;
  subtypes: string[];
  prev_assignee: string | null;
  next_assignee: string | null;
  reason: string;
}[] {
  const out = new Map<string, ReturnType<typeof foldMoves>[number]>();
  for (const r of rows) {
    const key = [
      r.university_name,
      r.work_kind,
      r.prev_assignee ?? "",
      r.next_assignee ?? "",
    ].join("|");
    const hit = out.get(key);
    if (!hit) {
      out.set(key, {
        key,
        university_name: r.university_name,
        work_kind: r.work_kind,
        subtypes: r.subtype ? [r.subtype] : [],
        prev_assignee: r.prev_assignee,
        next_assignee: r.next_assignee,
        reason: r.reason,
      });
      continue;
    }
    // 하위유형은 원장 순서를 따른다 — 여기서 다시 정렬하면 `수시 · 정시` 가 뒤집힌다.
    if (r.subtype && !hit.subtypes.includes(r.subtype)) {
      hit.subtypes.push(r.subtype);
    }
  }
  return [...out.values()];
}

const STATUS_LABEL: Record<ProposalBatchRow["status"], string> = {
  pending: "검토 대기",
  applied: "적용됨",
  rejected: "반려됨",
  partial: "일부 적용됨",
};

/** `toFixed` 만 쓰면 5.35 가 5.3 으로 내려간다(부동소수). 먼저 반올림한다. */
const oneDecimal = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

const groupLabel = (group: string) =>
  TENURE_GROUP_LABELS[group as TenureGroup] ?? group;

type Basis = {
  targets?: Record<string, { universities: number; density: number }>;
  limits?: { perOperator: number; perBatch: number };
  rejected?: {
    university_name: string;
    work_kind: string;
    gate: string;
    reason: string;
  }[];
};

/**
 * 이름으로 보여준다 — 메일 주소는 사람이 한 줄씩 대조하는 값이 아니다.
 * **명부에 없으면 주소를 그대로 둔다**: 빈칸으로 두면 미배정과 구분이 안 된다.
 */
const nameOf = (email: string | null, names: Record<string, string>) =>
  email === null ? "미배정" : (names[email] ?? email);

function BasisBlock({ basis }: { basis: Basis }) {
  const targets = Object.entries(basis.targets ?? {});
  const rejected = basis.rejected ?? [];
  if (targets.length === 0 && rejected.length === 0 && !basis.limits) {
    return null;
  }
  return (
    <details className="border border-line-soft bg-situation-bg px-3 py-2">
      <summary className="cursor-pointer text-xs text-ink">
        판정 근거 보기
      </summary>
      <div className="mt-2 space-y-2">
        {targets.length > 0 && (
          <ul className="space-y-0.5 text-2xs text-ink-soft tabular-nums">
            {targets.map(([g, t]) => (
              <li key={g}>
                {`${groupLabel(g)} · 목표 ${oneDecimal(t.universities)}곳 · 밀도 ${oneDecimal(t.density)}`}
              </li>
            ))}
          </ul>
        )}
        {basis.limits && (
          <p className="text-2xs text-muted tabular-nums">
            {`상한 — 운영자당 ${basis.limits.perOperator}곳 · 배치당 ${basis.limits.perBatch}곳`}
          </p>
        )}
        {rejected.length > 0 && (
          <div>
            <p className="text-2xs font-medium text-ink">
              {`검산에서 떨어진 줄 ${rejected.length}건`}
            </p>
            <ul className="mt-1 space-y-0.5">
              {rejected.map((r, i) => (
                <li
                  key={`${r.university_name}-${r.work_kind}-${i}`}
                  className="text-2xs text-ink-soft"
                >
                  {`${r.university_name} · ${r.work_kind} — ${r.gate} ${r.reason}`}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

export function ProposalPanel({
  batches,
  proposals,
  names,
}: {
  batches: ProposalBatchRow[];
  proposals: ProposalRow[];
  names: Record<string, string>;
}) {
  if (batches.length === 0) {
    return (
      <div className="border border-dashed border-line-soft bg-situation-bg p-8 text-center">
        <p className="text-sm text-muted">제안이 없습니다</p>
        <p className="mt-2 text-xs text-muted">
          학년도 배정 요청 잡이 돌면 여기에 배치가 쌓입니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {batches.map((b) => {
        const rows = proposals.filter((p) => p.batch_id === b.id);
        const universities = new Set(rows.map((r) => r.university_name)).size;
        return (
          <section key={b.id} className="border border-line-soft bg-paper">
            <header className="space-y-2 border-b border-line-soft px-3 py-3">
              <p className="text-sm font-medium text-ink tabular-nums">
                {`${b.academic_year}학년도 ${b.kind === "single" ? "단건" : "전체"} · ${STATUS_LABEL[b.status]}`}
              </p>
              <p className="text-xs text-ink-soft tabular-nums">
                {`제안 ${rows.length}건 · 변경 대학 ${universities}곳 · ${kstDateTime.format(new Date(b.created_at))}`}
              </p>
              {b.summary && <p className="text-xs text-muted">{b.summary}</p>}
              {/*
               * **적용 전까지 사실이 아니다**(§5.4). 이 줄이 없으면 표가 확정처럼
               * 보이고, 관리자는 확인 없이 넘긴다.
               */}
              {b.status === "pending" ? (
                <p className="text-xs text-vermilion">
                  아직 적용되지 않았습니다 — 승인해야 원장이 바뀝니다.
                </p>
              ) : (
                /* 상태는 머리에 이미 있다 — 여기는 **누가 언제** 만 적는다. */
                <p className="text-xs text-muted">
                  {[
                    b.decided_by,
                    b.decided_at
                      ? kstDateTime.format(new Date(b.decided_at))
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "결정 기록이 없습니다"}
                </p>
              )}
              <BasisBlock basis={(b.basis ?? {}) as Basis} />
              {b.status === "pending" && <ProposalDecision batchId={b.id} />}
            </header>

            {rows.length === 0 ? (
              /* 빈 배치도 보여준다 — 조용히 사라지면 판정이 돈 사실이 안 남는다. */
              <p className="px-3 py-4 text-xs text-muted">
                옮길 것이 없습니다 — 검산을 통과한 이동이 없습니다.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm tabular-nums">
                  <thead>
                    <tr className="border-b border-line-soft text-xs text-muted">
                      {COLUMNS.map((c) => (
                        <th
                          key={c}
                          scope="col"
                          className="px-3 py-2 font-normal"
                        >
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {foldMoves(rows).map((m) => (
                      <Fragment key={m.key}>
                        <tr>
                          <td className="whitespace-nowrap px-3 pt-2 font-medium text-ink">
                            {m.university_name}
                          </td>
                          <td className="whitespace-nowrap px-3 pt-2 text-ink-soft">
                            {m.work_kind}
                          </td>
                          <td className="px-3 pt-2 text-muted">
                            {m.subtypes.length === 0
                              ? "—"
                              : m.subtypes.join(" · ")}
                          </td>
                          <td className="whitespace-nowrap px-3 pt-2 text-ink">
                            {nameOf(m.prev_assignee, names)}
                            <span className="px-1 text-muted">→</span>
                            <b className="font-medium">
                              {nameOf(m.next_assignee, names)}
                            </b>
                          </td>
                        </tr>
                        {/*
                          * 근거는 제 줄에서 폭을 다 쓴다. 같은 이동의 하위유형들이 같은
                          * 근거를 갖고 있어, 접은 뒤에는 한 번만 적힌다.
                          */}
                        <tr className="border-b border-line-soft">
                          <td
                            colSpan={COLUMNS.length}
                            className="px-3 pb-2 text-2xs text-ink-soft"
                          >
                            {m.reason}
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
