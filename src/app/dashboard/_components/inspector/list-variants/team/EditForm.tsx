import type { ListRow } from "../../../patterns/ListPattern";
import type { EditFormProps } from "../types";
import { OPERATORS } from "@/features/auth/operators";
import type { OperatorPermission } from "@/features/operators/schemas";
import { sidebarSections, type SbItem } from "../../../../_data";

export function TeamForm({
  row,
  setRow,
  onSave,
  onCancel,
  currentUserPermission = null,
}: EditFormProps) {
  const canEditPermission = currentUserPermission === "admin";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">이름</span>
        <input
          aria-label="이름"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">이메일</span>
        <input
          aria-label="이메일"
          value={row.id}
          onChange={(e) => setRow({ ...row, id: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 font-mono text-ink transition-colors focus:border-ink focus:bg-white"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">전화번호</span>
        <input
          aria-label="전화번호"
          value={row.operatorPhone ?? ""}
          onChange={(e) =>
            setRow({ ...row, operatorPhone: e.target.value || undefined })
          }
          placeholder="예: (02)2013-0669"
          className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">팀</span>
        <select
          aria-label="팀"
          value={row.owner}
          onChange={(e) => setRow({ ...row, owner: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
        >
          <option value="운영1팀">운영1팀</option>
          <option value="운영2팀">운영2팀</option>
        </select>
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">직급</span>
        <select
          aria-label="직급"
          value={row.meta ?? ""}
          onChange={(e) => setRow({ ...row, meta: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
        >
          <option value="사장">사장</option>
          <option value="이사">이사</option>
          <option value="본부장">본부장</option>
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
          value={row.leader ?? ""}
          onChange={(e) => setRow({ ...row, leader: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
        >
          <option value="">자동 derive (팀장/부장)</option>
          {OPERATORS.filter((x) => x.email !== row.id).map((op) => (
            <option key={op.email} value={op.name}>
              {op.name} · {op.role} · {op.team}
            </option>
          ))}
          <option value="이사">이사</option>
        </select>
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">상태</span>
        <select
          aria-label="상태"
          value={row.status}
          onChange={(e) =>
            setRow({ ...row, status: e.target.value as ListRow["status"] })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
        >
          <option value="active">활성</option>
          <option value="inactive">점검중</option>
          <option value="suspended">정지</option>
          <option value="deleted">삭제</option>
        </select>
      </label>
      {canEditPermission && (
        <label className="block text-xs">
          <span className="mb-1 block text-muted">권한</span>
          <select
            aria-label="권한"
            value={row.permission ?? "member"}
            onChange={(e) =>
              setRow({
                ...row,
                permission: e.target.value as OperatorPermission,
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
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
          <p className="mb-2 text-2xs leading-relaxed text-muted">
            현재 정책: admin은 전체 메뉴, member·viewer는 admin 전용 5개(조직권한·시스템설정·공지사항·성과리포트·자동화 실행)를 제외한 전체 메뉴를 자동 접근. 개별 토글은 사용하지 않습니다.
          </p>
          <div className="space-y-3 border border-line bg-cream p-2">
            {sidebarSections.map((section) => {
              const isAdmin = row.permission === "admin";
              const items: SbItem[] = section.entries
                .flatMap<SbItem>((e) =>
                  e.kind === "item" ? [e] : e.items
                )
                .filter((it) => !!it.slug)
                .filter((it) => (isAdmin ? true : !it.adminOnly));
              if (items.length === 0) return null;
              return (
                <div key={section.title}>
                  <p className="mb-1 text-2xs uppercase tracking-[0.18em] text-muted">
                    {section.title}
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {items.map((it) => {
                      const slug = it.slug!;
                      return (
                        <label
                          key={slug}
                          className="flex items-center gap-1.5 text-ink opacity-70"
                        >
                          <input
                            type="checkbox"
                            aria-label={slug}
                            checked
                            disabled
                            readOnly
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
      {row.status === "deleted" && (
        <label className="block text-xs">
          <span className="mb-1 block text-muted">
            삭제 사유 <span className="text-vermilion">*</span>
          </span>
          <textarea
            aria-label="삭제 사유"
            required
            rows={3}
            value={row.deletedReason ?? ""}
            onChange={(e) =>
              setRow({ ...row, deletedReason: e.target.value })
            }
            placeholder="퇴사 / 권한 회수 / 부서 이동 등"
            className="w-full border border-line bg-cream px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
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
