import type { MetaItem } from "../_components/page-header/PageMeta";

export type PageMetaConfig = {
  headline: { title: string; accent?: string };
  meta?: MetaItem[];
  description?: string;
};

/**
 * slug별 명시 메타. 미정의 slug는 dashboard/[slug]/page.tsx에서 sidebar label로 fallback.
 * 시작은 mockup 매칭 services + 자주 보는 페이지 한정. 나머지는 fallback.
 */
export const PAGE_META: Record<string, PageMetaConfig> = {
  services: {
    headline: { accent: "실시간", title: "서비스 운영" },
    meta: [
      { label: "근무 II", tone: "accent" },
      { label: "서비스", value: "12개" },
      { label: "자동 새로고침", value: "10초" },
    ],
    description:
      "현재 운영 중인 서비스 목록입니다. 각 서비스의 상태·담당 팀·최근 이벤트를 확인하고, 선택 시 인스펙터에서 실시간 지표를 볼 수 있습니다. 주의 상태는 주홍색 낙관으로 표시됩니다.",
  },
  alerts: {
    headline: { accent: "지금", title: "주의해야 할 알림" },
    description:
      "운영 중 발생한 긴급·검토·정상 알림을 시간순으로 확인합니다. 항목 선택 시 인스펙터에서 상세 컨텍스트와 대응 액션을 볼 수 있습니다.",
  },
  "my-todo": {
    headline: { accent: "오늘", title: "내가 처리할 일" },
    description:
      "본인 전용 todo. 우선순위와 마감을 정해 체크박스로 빠르게 완료 처리. 다른 사람은 볼 수 없으며, 본인 외 데이터는 RLS로 차단.",
  },
  schedule: {
    headline: { accent: "이번 주", title: "전체 일정" },
    description:
      "운영부 공통 일정 — 시프트, 팀 이벤트, 휴가, 교육을 한곳에. 본인 일정은 직접 작성·수정·삭제할 수 있고, 팀 공통 일정은 admin이 관리합니다.",
  },
  handover: {
    headline: { accent: "교대", title: "인수인계" },
  },
  feedback: {
    headline: { accent: "관리", title: "개선요청" },
    description:
      "이 시스템(OPS Console)에 대한 개선 아이디어와 버그 리포트를 모읍니다. 운영 중 불편을 발견하면 자유롭게 작성해 주세요. 검토 후 처리 상태를 갱신합니다.",
  },
  onboarding: {
    headline: { accent: "관리", title: "온보딩" },
    description:
      "탭으로 가이드·체크리스트·회차 관리·활동 로그를 한 곳에. 신입은 가이드로 학습하고, 사수·admin은 회차 탭에서 진행도를 관리합니다.",
  },
  notices: {
    headline: { accent: "관리", title: "공지사항" },
    description:
      "운영부 전체에 전달하는 공지입니다. 시스템 정기 점검, 정책 변경, 신규 운영자 합류, 일정 조정 등 모든 공지가 한 곳에 누적됩니다. admin 권한 사용자만 작성할 수 있습니다.",
  },
};
