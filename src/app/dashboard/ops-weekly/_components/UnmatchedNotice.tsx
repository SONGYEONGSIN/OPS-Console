import Link from "next/link";

/**
 * 담당자 이름이 안 맞아 아무에게도 안 붙은 서비스 안내 — 관리자만 본다.
 * 비관리자에게는 고칠 수단이 없고(서비스마감 담당자 이름·작성 명단은 관리자 몫) 남의 일이 자기 보고서 머리에 뜬다.
 * 0 건도 적는다 — 0 을 지우면 '없다' 와 '안 세어 봤다' 가 화면에서 같아진다.
 */
export function UnmatchedNotice(props: {
  isAdmin: boolean;
  count: number;
  /** `서비스` / `발표 서비스` */
  noun: string;
  /** 0 건이 아닐 때 덧붙일 조치 */
  action: string;
  /** 관리 › 안 붙은 서비스 */
  settingsHref: string;
}) {
  if (!props.isAdmin) return null;
  const { count } = props;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <p className="text-sm text-muted">
        {`담당자가 맞지 않아 아무에게도 안 붙은 ${props.noun} ${count}건${
          count > 0 ? ` — ${props.action}` : ""
        }`}
      </p>
      {count > 0 ? (
        <Link href={props.settingsHref} className="text-xs underline">
          관리에서 목록 보기
        </Link>
      ) : null}
    </div>
  );
}
