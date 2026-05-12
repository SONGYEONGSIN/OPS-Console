"use client";

import { useState } from "react";
import type { ListRow } from "../patterns/ListPattern";
import {
  OPERATORS,
  ageOf,
  tenureLabel,
  tenureYears,
} from "@/features/auth/operators";
import {
  PERMISSION_LABEL,
  type OperatorPermission,
} from "@/features/operators/schemas";
import { postStatusKeys, postStatusLabel } from "../patterns/ListPattern";
import { sidebarSections, type SbItem } from "../../_data";
import { Section, DefList, Divider } from "./list-variants/shared";
import { variantRegistry } from "./list-variants/registry";

type Variant =
  | "default"
  | "team"
  | "post-feedback"
  | "post-notice"
  | "schedule"
  | "my-todo"
  | "cohort"
  | "receivables"
  | "ai-work";

type Props = {
  row: ListRow;
  editing: boolean;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
  variant?: Variant;
  /** team variant — 권한 select admin만 노출하기 위한 컨텍스트 */
  currentUserPermission?: OperatorPermission | null;
  /** cohort variant — 초대 메일 발송/재초대 (admin only). server action wrapper. */
  onInvite?: (id: string) => Promise<{ ok: boolean; error?: string }>;
  /** receivables variant — 적요 셀 PATCH server action. */
  onUpdateRemarks?: (
    row: ListRow,
    newText: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  /** receivables variant — 독려 메일 발송이 dry-run 모드인지 (env 기반). */
  receivablesMailDryRun?: boolean;
};

/**
 * InspectorListBody — list pattern row 인스펙터 본문.
 * mockup folio-dashboard.html 의 인스펙터 패널 구조 매칭:
 *   1) 헤더 (overline · title · meta · 상태 동그라미)
 *   2) 속성 section
 *   3) 실시간 지표 section
 *   4) 담당 · 온콜 section
 * 데모 데이터는 row 정보 기반 + 고정 mock 혼합.
 */
export function InspectorListBody({
  row,
  editing,
  onSave,
  onCancel,
  variant = "default",
  currentUserPermission = null,
  onInvite,
  onUpdateRemarks,
  receivablesMailDryRun = true,
}: Props) {
  const [draft, setDraft] = useState<ListRow>(row);

  if (!editing) {
    return (
      <ViewMode
        row={row}
        variant={variant}
        currentUserPermission={currentUserPermission}
        receivablesMailDryRun={receivablesMailDryRun}
      />
    );
  }

  const isTeam = variant === "team";
  const isPost = variant === "post-feedback" || variant === "post-notice";
  const postVariant: "post-feedback" | "post-notice" | null = isPost ? variant : null;
  const isSchedule = variant === "schedule";
  const isMyTodo = variant === "my-todo";
  const canEditPermission = isTeam && currentUserPermission === "admin";

  if (isSchedule) {
    return <ScheduleForm row={draft} setRow={setDraft} onSave={onSave} onCancel={onCancel} />;
  }

  if (isMyTodo) {
    return <MyTodoForm row={draft} setRow={setDraft} onSave={onSave} onCancel={onCancel} />;
  }

  {
    const entry = variantRegistry[variant as keyof typeof variantRegistry];
    if (entry) {
      const EditForm = entry.EditForm;
      return (
        <EditForm
          row={draft}
          setRow={setDraft}
          onSave={onSave}
          onCancel={onCancel}
          onInvite={onInvite}
          onUpdateRemarks={onUpdateRemarks}
        />
      );
    }
  }

  if (isPost && postVariant) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
        className="space-y-3"
      >
        <label className="block text-xs">
          <span className="mb-1 block text-muted">제목</span>
          <input
            aria-label="제목"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
            placeholder="제목을 입력해주세요"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">내용</span>
          <textarea
            aria-label="내용"
            value={draft.body ?? ""}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            rows={8}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
            placeholder="본문을 작성해주세요"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">등록자</span>
          <select
            aria-label="등록자"
            value={draft.author ?? ""}
            onChange={(e) => setDraft({ ...draft, author: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="">선택…</option>
            {(postVariant === "post-notice"
              ? OPERATORS.filter(
                  (o) => o.role === "부장" || o.role === "팀장",
                )
              : OPERATORS
            ).map((op) => (
              <option key={op.email} value={op.name}>
                {op.name} · {op.role}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">상태</span>
          <select
            aria-label="상태"
            value={draft.status}
            onChange={(e) =>
              setDraft({ ...draft, status: e.target.value as ListRow["status"] })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            {postStatusKeys(postVariant).map((s) => (
              <option key={s} value={s}>
                {postStatusLabel(postVariant, s)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
          >
            저장
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
          >
            취소
          </button>
        </div>
        {row.id !== "" && (
          <div className="border-t border-line-soft pt-3">
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "이 글을 삭제하시겠습니까? 되돌릴 수 없습니다.",
                  )
                ) {
                  onSave({ ...draft, status: "deleted" });
                }
              }}
              className="w-full border border-vermilion-deep bg-transparent px-3 py-1.5 text-sm text-vermilion-deep hover:bg-vermilion-deep hover:text-cream"
            >
              삭제
            </button>
          </div>
        )}
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">이름</span>
        <input
          aria-label="이름"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">{isTeam ? "이메일" : "ID"}</span>
        <input
          aria-label={isTeam ? "이메일" : "ID"}
          value={draft.id}
          onChange={(e) => setDraft({ ...draft, id: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 font-mono text-ink"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">{isTeam ? "팀" : "담당"}</span>
        {isTeam ? (
          <select
            aria-label="팀"
            value={draft.owner}
            onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="운영1팀">운영1팀</option>
            <option value="운영2팀">운영2팀</option>
          </select>
        ) : (
          <input
            aria-label="담당"
            value={draft.owner}
            onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        )}
      </label>
      {isTeam && (
        <>
          <label className="block text-xs">
            <span className="mb-1 block text-muted">직급</span>
            <select
              aria-label="직급"
              value={draft.meta ?? ""}
              onChange={(e) => setDraft({ ...draft, meta: e.target.value })}
              className="w-full border border-line bg-cream px-2 py-1 text-ink"
            >
              <option value="부장">부장</option>
              <option value="팀장">팀장</option>
              <option value="TL">TL</option>
              <option value="매니저">매니저</option>
            </select>
          </label>
          <label className="block text-xs">
            <span className="mb-1 block text-muted">
              직속 상사 <span className="text-faint">(미설정 시 자동)</span>
            </span>
            <select
              aria-label="직속 상사"
              value={draft.leader ?? ""}
              onChange={(e) => setDraft({ ...draft, leader: e.target.value })}
              className="w-full border border-line bg-cream px-2 py-1 text-ink"
            >
              <option value="">자동 derive (팀장/부장)</option>
              {OPERATORS.filter((x) => x.email !== draft.id).map((op) => (
                <option key={op.email} value={op.name}>
                  {op.name} · {op.role} · {op.team}
                </option>
              ))}
              <option value="본부장 (외부)">본부장 (외부)</option>
            </select>
          </label>
        </>
      )}
      <label className="block text-xs">
        <span className="mb-1 block text-muted">상태</span>
        <select
          aria-label="상태"
          value={draft.status}
          onChange={(e) =>
            setDraft({ ...draft, status: e.target.value as ListRow["status"] })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          {isTeam ? (
            <>
              <option value="active">활성</option>
              <option value="inactive">점검중</option>
              <option value="suspended">정지</option>
              <option value="deleted">삭제</option>
            </>
          ) : (
            <>
              <option value="active">활성</option>
              <option value="approved">정상</option>
              <option value="review">점검중</option>
              <option value="urgent">긴급</option>
            </>
          )}
        </select>
      </label>
      {canEditPermission && (
        <label className="block text-xs">
          <span className="mb-1 block text-muted">권한</span>
          <select
            aria-label="권한"
            value={draft.permission ?? "member"}
            onChange={(e) =>
              setDraft({
                ...draft,
                permission: e.target.value as OperatorPermission,
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            <option value="admin">관리자 (admin)</option>
            <option value="member">구성원 (member)</option>
            <option value="viewer">뷰어 (viewer)</option>
          </select>
        </label>
      )}
      {canEditPermission && (
        <fieldset className="block text-xs">
          <legend className="mb-1 block text-muted">메뉴 권한</legend>
          <div className="space-y-3 border border-line bg-cream p-2">
            {sidebarSections.map((section) => {
              const items: SbItem[] = section.entries
                .flatMap<SbItem>((e) =>
                  e.kind === "item" ? [e] : e.items
                )
                .filter((it) => !!it.slug);
              if (items.length === 0) return null;
              return (
                <div key={section.title}>
                  <p className="mb-1 text-2xs uppercase tracking-[0.18em] text-muted">
                    {section.title}
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {items.map((it) => {
                      const slug = it.slug!;
                      const isAdmin = draft.permission === "admin";
                      // admin은 canViewMenu에서 bypass라 실 권한 전체 — 시각적으로도 전체 체크
                      const checked = isAdmin
                        ? true
                        : (draft.allowedMenus ?? []).includes(slug);
                      return (
                        <label
                          key={slug}
                          className={`flex items-center gap-1.5 text-ink ${
                            isAdmin ? "opacity-60" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            aria-label={slug}
                            checked={checked}
                            disabled={isAdmin}
                            onChange={(e) => {
                              const current = draft.allowedMenus ?? [];
                              const next = e.target.checked
                                ? [...current, slug]
                                : current.filter((s) => s !== slug);
                              setDraft({ ...draft, allowedMenus: next });
                            }}
                            className="h-3.5 w-3.5"
                          />
                          <span className="truncate">{it.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </fieldset>
      )}
      {isTeam && draft.status === "deleted" && (
        <label className="block text-xs">
          <span className="mb-1 block text-muted">
            삭제 사유 <span className="text-vermilion">*</span>
          </span>
          <textarea
            aria-label="삭제 사유"
            required
            rows={3}
            value={draft.deletedReason ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, deletedReason: e.target.value })
            }
            placeholder="퇴사 / 권한 회수 / 부서 이동 등"
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      )}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
    </form>
  );
}

/* ════════════════════════════════════════════════════════════
   ViewMode — mockup 3섹션 풍부 구조
   ════════════════════════════════════════════════════════════ */
function ViewMode({
  row,
  variant,
  currentUserPermission = null,
  receivablesMailDryRun = true,
}: {
  row: ListRow;
  variant: Variant;
  currentUserPermission?: OperatorPermission | null;
  receivablesMailDryRun?: boolean;
}) {
  if (variant === "team") return <TeamView row={row} />;
  if (variant === "post-feedback" || variant === "post-notice")
    return <PostView row={row} variant={variant} />;
  {
    const entry = variantRegistry[variant as keyof typeof variantRegistry];
    if (entry) {
      const View = entry.View;
      return (
        <View
          row={row}
          currentUserPermission={currentUserPermission}
          receivablesMailDryRun={receivablesMailDryRun}
        />
      );
    }
  }
  return <ServiceView row={row} />;
}

function PostView({
  row,
  variant,
}: {
  row: ListRow;
  variant: "post-feedback" | "post-notice";
}) {
  const statusLabel = postStatusLabel(variant, row.status);
  const statusColor = STATUS_BADGE[row.status];

  return (
    <div className="space-y-6">
      <Section title="게시글 정보">
        <DefList
          items={[
            { term: "글번호", desc: <span className="font-mono">{row.slug ?? (row.id || "-")}</span> },
            { term: "등록자", desc: row.author || "-" },
            { term: "작성일", desc: row.meta ?? "-" },
            {
              term: "상태",
              desc: (
                <span className={`inline-block px-2 py-0.5 text-xs ${statusColor}`}>
                  {statusLabel}
                </span>
              ),
            },
          ]}
        />
      </Section>

      <Divider />

      <Section title="본문">
        {row.body ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {row.body}
          </p>
        ) : (
          <p className="text-xs text-muted">(본문이 비어 있습니다)</p>
        )}
      </Section>
    </div>
  );
}


function ServiceView({ row }: { row: ListRow }) {
  const statusLabel = STATUS_LABEL[row.status];
  const statusColor = STATUS_BADGE[row.status];

  return (
    <div className="space-y-6">
      <Section title="속성">
        <DefList
          items={[
            { term: "항목 ID", desc: <span className="font-mono">{row.id}</span> },
            { term: "네임스페이스", desc: "ops / 운영" },
            { term: "담당", desc: row.owner },
            { term: "포트", desc: ":8080 HTTP · :9000 gRPC" },
            { term: "리전", desc: "ap-northeast-2 · 3 AZ" },
            { term: "런타임", desc: "Node 22 · Next.js 16" },
            {
              term: "상태",
              desc: (
                <span className={`inline-block px-2 py-0.5 text-xs ${statusColor}`}>
                  {statusLabel}
                </span>
              ),
            },
          ]}
        />
      </Section>

      <Divider />

      <Section title="실시간 지표">
        <DefList
          items={[
            {
              term: "처리량",
              desc: (
                <span>
                  12,480 req/s <span className="text-sage">▲ 8.2%</span> 전일 대비
                </span>
              ),
            },
            {
              term: "p99 응답",
              desc: (
                <strong className="font-bold text-vermilion">
                  184 ms · 임계 150ms 초과
                </strong>
              ),
            },
            {
              term: "오류율",
              desc: (
                <strong className="font-bold text-vermilion">
                  0.42% · 경고 단계
                </strong>
              ),
            },
            { term: "CPU", desc: "62% · 12 인스턴스 평균" },
            {
              term: "메모리",
              desc: <span className="text-gold">78% · 임계 85% 근접</span>,
            },
          ]}
        />
      </Section>

      <Divider />

      <Section title="담당 · 온콜">
        <DefList
          items={[
            { term: "담당 팀", desc: `${row.owner} · L3 엔지니어링` },
            { term: "1차 온콜", desc: "박현주 · 다음 교대까지 7시간" },
            { term: "2차 온콜", desc: "김지현" },
            { term: "에스컬레이션", desc: "플랫폼 엔지니어링 (자동 · T+30m)" },
          ]}
        />
      </Section>
    </div>
  );
}

function TeamView({ row }: { row: ListRow }) {
  const statusLabel = STATUS_LABEL[row.status];
  const statusColor = STATUS_BADGE[row.status];
  const op = OPERATORS.find((x) => x.email === row.id);

  // OPERATORS lookup 실패 시 (예: 테스트 더미 데이터) 기존 row 기반 단순 노출.
  if (!op) {
    return (
      <div className="space-y-6">
        <Section title="계정 정보">
          <DefList
            items={[
              { term: "이름", desc: <strong className="font-semibold">{row.name}</strong> },
              { term: "이메일", desc: <span className="font-mono text-xs">{row.id}</span> },
              {
                term: "시스템 권한",
                desc: row.permission ? PERMISSION_LABEL[row.permission] : "-",
              },
              { term: "소속 팀", desc: row.owner },
              { term: "직급", desc: row.meta ?? "-" },
              {
                term: "상태",
                desc: (
                  <span className={`inline-block px-2 py-0.5 text-xs ${statusColor}`}>
                    {statusLabel}
                  </span>
                ),
              },
            ]}
          />
        </Section>
      </div>
    );
  }

  const tenure = tenureLabel(op.hiredAt);
  const tenureY = tenureYears(op.hiredAt);
  const age = ageOf(op.birthDate);

  return (
    <div className="space-y-6">
      <Section title="인사 정보">
        <DefList
          items={[
            { term: "사번", desc: <span className="font-mono">{op.empNo}</span> },
            { term: "이름", desc: <strong className="font-semibold">{op.name}</strong> },
            { term: "성별", desc: op.gender },
            { term: "생년월일", desc: `${op.birthDate} (만 ${age}세)` },
            { term: "본부", desc: op.division },
            { term: "부서", desc: op.department },
            { term: "팀", desc: op.team },
            { term: "직급", desc: op.role },
            {
              term: "상태",
              desc: (
                <span className={`inline-block px-2 py-0.5 text-xs ${statusColor}`}>
                  {statusLabel}
                </span>
              ),
            },
          ]}
        />
      </Section>

      <Divider />

      <Section title="근속 · 계정">
        <DefList
          items={[
            { term: "입사일", desc: op.hiredAt },
            {
              term: "근속",
              desc: (
                <span>
                  {tenure} <span className="text-muted">· {tenureY}년</span>
                </span>
              ),
            },
            { term: "이메일", desc: <span className="font-mono text-xs">{op.email}</span> },
            {
              term: "시스템 권한",
              desc: row.permission ? PERMISSION_LABEL[row.permission] : "-",
            },
            { term: "직급 권한", desc: roleToPermission(op.role) },
            { term: "SSO", desc: "Microsoft Entra · 14일 자동 갱신" },
          ]}
        />
      </Section>

      <Divider />

      <Section title="조직 · 보고 라인">
        <DefList
          items={[
            { term: "소속 팀", desc: `${op.department} · ${op.team}` },
            {
              term: "직속 상사",
              desc: row.leader ? row.leader : leaderOf(op),
            },
            { term: "팀 동료", desc: peersOf(op).join(" · ") || "-" },
          ]}
        />
      </Section>
    </div>
  );
}

function roleToPermission(role: string): string {
  switch (role) {
    case "부장":
      return "L4 관리자 · 전체 권한";
    case "팀장":
      return "L3 팀 관리자 · 팀 전체 권한";
    case "TL":
      return "L2 시니어 · 운영 + 검토";
    case "매니저":
      return "L1 운영자 · 운영 권한";
    default:
      return "L0 일반";
  }
}

function leaderOf(op: { team: string; role: string }): string {
  if (op.role === "부장") return "본부장 (외부)";
  if (op.role === "팀장") {
    const head = OPERATORS.find((x) => x.role === "부장");
    return head ? `${head.name} · ${head.role}` : "-";
  }
  // 매니저/TL → 같은 팀 팀장 또는 부장
  const tl = OPERATORS.find((x) => x.team === op.team && x.role === "팀장");
  if (tl) return `${tl.name} · ${tl.role}`;
  const buchang = OPERATORS.find((x) => x.role === "부장");
  return buchang ? `${buchang.name} · ${buchang.role}` : "-";
}

function peersOf(op: { team: string; email: string }): string[] {
  return OPERATORS.filter((x) => x.team === op.team && x.email !== op.email)
    .slice(0, 3)
    .map((x) => x.name);
}

/* ════════════════════════════════════════════════════════════
   helpers
   ════════════════════════════════════════════════════════════ */
const STATUS_LABEL: Record<ListRow["status"], string> = {
  urgent: "장애",
  active: "활성",
  review: "점검중",
  approved: "정상",
  inactive: "점검중",
  suspended: "정지",
  deleted: "삭제",
};

const STATUS_BADGE: Record<ListRow["status"], string> = {
  urgent: "bg-vermilion text-cream",
  active: "bg-sage/20 text-sage",
  review: "bg-gold/20 text-gold",
  approved: "bg-line-soft text-muted",
  inactive: "bg-gold/20 text-gold",
  suspended: "bg-vermilion/20 text-vermilion",
  deleted: "bg-ink/20 text-ink-soft",
};

const SCHEDULE_TYPE_OPTIONS: {
  value: "shift" | "event" | "leave" | "training";
  label: string;
}[] = [
  { value: "shift", label: "시프트" },
  { value: "event", label: "이벤트" },
  { value: "leave", label: "휴가" },
  { value: "training", label: "교육" },
];

const TODO_PRIORITY_OPTIONS: {
  value: "low" | "medium" | "high";
  label: string;
}[] = [
  { value: "high", label: "높음" },
  { value: "medium", label: "보통" },
  { value: "low", label: "낮음" },
];

/**
 * ISO 8601 (Z) → datetime-local input 형식 ("YYYY-MM-DDTHH:mm") for KST.
 */
function isoToLocalKst(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  // UTC + 9h shift, then strip 'Z' and seconds.
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16);
}

/**
 * datetime-local input ("YYYY-MM-DDTHH:mm", KST 가정) → ISO 8601 Z.
 */
function localKstToIso(local: string): string {
  if (!local) return "";
  return new Date(`${local}:00+09:00`).toISOString();
}

function ScheduleForm({
  row,
  setRow,
  onSave,
  onCancel,
}: {
  row: ListRow;
  setRow: (next: ListRow) => void;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">제목</span>
        <input
          aria-label="제목"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="일정 제목"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">설명</span>
        <textarea
          aria-label="설명"
          value={row.body ?? ""}
          onChange={(e) => setRow({ ...row, body: e.target.value })}
          rows={4}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="설명 (선택)"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">타입</span>
        <select
          aria-label="타입"
          value={row.scheduleType ?? "event"}
          onChange={(e) =>
            setRow({
              ...row,
              scheduleType: e.target.value as ListRow["scheduleType"],
            })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          {SCHEDULE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">시작 (KST)</span>
          <input
            type="datetime-local"
            aria-label="시작"
            value={isoToLocalKst(row.start_at)}
            onChange={(e) =>
              setRow({ ...row, start_at: localKstToIso(e.target.value) })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">종료 (KST)</span>
          <input
            type="datetime-local"
            aria-label="종료"
            value={isoToLocalKst(row.end_at ?? undefined)}
            onChange={(e) =>
              setRow({
                ...row,
                end_at: e.target.value ? localKstToIso(e.target.value) : null,
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink">
        <input
          type="checkbox"
          aria-label="종일"
          checked={row.allDay ?? false}
          onChange={(e) => setRow({ ...row, allDay: e.target.checked })}
        />
        종일 일정
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">담당자</span>
        <select
          aria-label="담당자"
          value={row.assigneeEmail ?? ""}
          onChange={(e) =>
            setRow({
              ...row,
              assigneeEmail: e.target.value || null,
              owner: e.target.value
                ? (OPERATORS.find((o) => o.email === e.target.value)?.name ??
                  "")
                : "",
            })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          <option value="">팀 공통 (담당자 없음)</option>
          {OPERATORS.map((op) => (
            <option key={op.email} value={op.email}>
              {op.name} · {op.role}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
      {row.id !== "" && (
        <div className="border-t border-line-soft pt-3">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm("이 일정을 삭제하시겠습니까? 되돌릴 수 없습니다.")
              ) {
                onSave({ ...row, status: "deleted" });
              }
            }}
            className="w-full border border-vermilion-deep bg-transparent px-3 py-1.5 text-sm text-vermilion-deep hover:bg-vermilion-deep hover:text-cream"
          >
            삭제
          </button>
        </div>
      )}
    </form>
  );
}

function MyTodoForm({
  row,
  setRow,
  onSave,
  onCancel,
}: {
  row: ListRow;
  setRow: (next: ListRow) => void;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">제목</span>
        <input
          aria-label="제목"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="할 일"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">내용</span>
        <textarea
          aria-label="내용"
          value={row.body ?? ""}
          onChange={(e) => setRow({ ...row, body: e.target.value })}
          rows={4}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="설명 (선택)"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">우선순위</span>
          <select
            aria-label="우선순위"
            value={row.priority ?? "medium"}
            onChange={(e) =>
              setRow({
                ...row,
                priority: e.target.value as ListRow["priority"],
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            {TODO_PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">마감 (KST, 선택)</span>
          <input
            type="datetime-local"
            aria-label="마감"
            value={isoToLocalKst(row.dueAt ?? undefined)}
            onChange={(e) =>
              setRow({
                ...row,
                dueAt: e.target.value ? localKstToIso(e.target.value) : null,
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink">
        <input
          type="checkbox"
          aria-label="완료"
          checked={row.done ?? false}
          onChange={(e) => {
            const nextDone = e.target.checked;
            setRow({
              ...row,
              done: nextDone,
              doneAt: nextDone ? new Date().toISOString() : null,
            });
          }}
        />
        완료됨
      </label>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
      {row.id !== "" && (
        <div className="border-t border-line-soft pt-3">
          <button
            type="button"
            onClick={() => {
              if (window.confirm("이 todo를 삭제하시겠습니까? 되돌릴 수 없습니다.")) {
                onSave({ ...row, status: "deleted" });
              }
            }}
            className="w-full border border-vermilion-deep bg-transparent px-3 py-1.5 text-sm text-vermilion-deep hover:bg-vermilion-deep hover:text-cream"
          >
            삭제
          </button>
        </div>
      )}
    </form>
  );
}

