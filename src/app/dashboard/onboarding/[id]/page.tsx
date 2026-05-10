import Link from "next/link";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCohortById } from "@/features/onboarding/queries";
import { OPERATORS } from "@/features/auth/operators";

/**
 * /dashboard/onboarding/[id] — 회차 상세.
 * 본 epic은 read-only 메타 표시만. 주차별 세션 그리드는 후속 epic.
 */
export default async function CohortDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireMenu("onboarding");
  const { id } = await params;
  const cohort = await getCohortById(id);

  if (!cohort) {
    return (
      <div className="p-7">
        <h1 className="text-xl font-bold text-ink">회차를 찾을 수 없습니다</h1>
        <p className="mt-2 text-sm text-muted">
          ID: <span className="font-mono">{id}</span>
        </p>
        <Link
          href="/dashboard/onboarding"
          prefetch={false}
          className="mt-4 inline-block text-sm text-vermilion underline hover:text-vermilion-deep"
        >
          ← 회차 목록
        </Link>
      </div>
    );
  }

  const trainee = OPERATORS.find((o) => o.email === cohort.trainee_email);
  const mentor = cohort.mentor_email
    ? OPERATORS.find((o) => o.email === cohort.mentor_email)
    : null;

  return (
    <div className="p-7">
      <Link
        href="/dashboard/onboarding"
        prefetch={false}
        className="mb-3 inline-block text-xs text-vermilion underline hover:text-vermilion-deep"
      >
        ← 회차 목록
      </Link>
      <h1 className="text-2xl font-bold text-ink">{cohort.title}</h1>
      <dl className="mt-6 grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-xs text-muted">신입</dt>
        <dd className="text-ink">
          {trainee?.name ?? cohort.trainee_email}{" "}
          {trainee && (
            <span className="text-muted">
              · {trainee.role} · {trainee.team}
            </span>
          )}
        </dd>
        <dt className="text-xs text-muted">사수</dt>
        <dd className="text-ink">
          {mentor ? `${mentor.name} · ${mentor.role}` : "미정"}
        </dd>
        <dt className="text-xs text-muted">기간</dt>
        <dd className="text-ink">
          {cohort.start_date} ~ {cohort.end_date ?? "진행 중"}
        </dd>
        <dt className="text-xs text-muted">상태</dt>
        <dd className="text-ink">{cohort.status}</dd>
        {cohort.notes && (
          <>
            <dt className="text-xs text-muted">비고</dt>
            <dd className="whitespace-pre-line text-ink">{cohort.notes}</dd>
          </>
        )}
      </dl>
      <p className="mt-8 border-t border-line-soft pt-4 text-xs text-muted">
        주차별 교육 세션 그리드는 후속 epic에서 추가됩니다.
      </p>
    </div>
  );
}
