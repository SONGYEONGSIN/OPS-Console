import type { MetaItem } from "../_components/page-header/PageMeta";

export type PageMetaConfig = {
  headline: { title: string; accent?: string };
  meta?: MetaItem[];
  description?: string;
};

/**
 * slug별 명시 메타. description은 1줄(짧은 한 문장)로 통일 — 페이지 헤드에 깔끔히 들어가게.
 * 미정의 slug는 dashboard/[slug]/page.tsx에서 sidebar label로 fallback.
 */
export const PAGE_META: Record<string, PageMetaConfig> = {
  services: {
    headline: { accent: "서비스사이클", title: "서비스" },
    description: "현재 운영 중인 서비스 목록을 확인하고 인스펙터에서 상세 지표를 봅니다.",
  },
  alerts: {
    headline: { accent: "지금", title: "주의해야 할 알림" },
    description: "긴급·검토·정상 알림을 시간순으로 확인하고 인스펙터에서 상세를 봅니다.",
  },
  "my-todo": {
    headline: { accent: "내 계획", title: "원서접수 · 프로젝트" },
    description: "원서접수 weekly 진행과 본인 프로젝트(Gantt)를 한곳에 관리합니다.",
  },
  schedule: {
    headline: { accent: "이번 주", title: "운영부 달력" },
    description: "운영부 시프트·이벤트·휴가·교육 일정을 한곳에 관리합니다.",
  },
  handover: {
    headline: { accent: "요청 · 자료", title: "인수인계" },
    description: "서비스별 인수인계 내용을 카테고리별로 작성·조회합니다.",
  },
  feedback: {
    headline: { accent: "관리", title: "개선요청" },
    description: "OPS Console에 대한 개선 아이디어와 버그 리포트를 모읍니다.",
  },
  onboarding: {
    headline: { accent: "관리", title: "온보딩" },
    description: "가이드·체크리스트로 학습하고, 자료실에서 사내 도구·문서를 찾습니다.",
  },
  notices: {
    headline: { accent: "관리", title: "공지사항" },
    description: "운영부 전체에 전달하는 공지사항입니다. admin만 작성합니다.",
  },
  "ai-tips": {
    headline: { accent: "AI & 자동화", title: "TIP 공유" },
    description: "운영부 공통 AI 활용 팁과 재사용 가능한 프롬프트를 모읍니다.",
  },
  settings: {
    headline: { accent: "관리", title: "시스템 설정" },
    description: "본인 프로필·권한·메일·외부 연동·시스템 정보를 한곳에서 확인합니다.",
  },
};
