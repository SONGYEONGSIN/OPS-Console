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
  assignments: {
    headline: { accent: "서비스사이클", title: "총괄장" },
    description: "대학별 운영/개발 배정·업무분장·가격정책을 조회합니다.",
  },
  outcomes: {
    headline: { accent: "분석 · AI", title: "성과리포트" },
    description:
      "8단계 평가 워크플로우로 목표·계획·평가를 한곳에서 관리합니다.",
  },
  reports: {
    headline: { accent: "분석 · 보고", title: "분석보고서" },
    description:
      "기간별 운영 KPI 8 카드(서비스·사고·계약·미수채권·인수인계·백업·메일·워크로그) + 저장된 리포트 목록.",
  },
  manuals: {
    headline: { accent: "매뉴얼 · 가이드", title: "운영 매뉴얼" },
    description:
      "SharePoint 운영부/05. 매뉴얼 폴더의 매뉴얼·업무흐름도·체크리스트를 카테고리별로 조회합니다.",
  },
  "operating-guide": {
    headline: { accent: "매뉴얼 · 가이드", title: "운영 가이드" },
    description:
      "바이브코딩·운영 노하우·트러블슈팅·협업·도구 사용법을 탭별로 정리한 운영부 공통 가이드입니다.",
  },
  services: {
    headline: { accent: "서비스사이클", title: "서비스목록" },
    description:
      "현재 운영 중인 서비스 목록을 확인하고 인스펙터에서 상세 지표를 봅니다.",
  },
  "my-todo": {
    headline: { accent: "내 계획", title: "주요업무 · 프로젝트" },
    description:
      "주요업무 weekly 진행과 본인 프로젝트(Gantt)를 한곳에 관리합니다.",
  },
  schedule: {
    headline: { accent: "이번 달", title: "운영부 달력" },
    description: "운영부 시프트·이벤트·휴가·교육 일정을 한곳에 관리합니다.",
  },
  news: {
    headline: { accent: "개요", title: "운영부 뉴스" },
    description:
      "대학 통폐합·폐교·정원감축 등 운영부 관련 뉴스를 자동 수집해 최신순으로 모아봅니다.",
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
    description:
      "가이드·체크리스트로 학습하고, 자료실에서 사내 도구·문서를 찾습니다.",
  },
  notices: {
    headline: { accent: "관리", title: "공지사항" },
    description: "운영부 전체에 전달하는 공지사항입니다. admin만 작성합니다.",
  },
  "ai-tips": {
    headline: { accent: "AI & 자동화", title: "TIP 공유" },
    description: "운영부 공통 AI 활용 팁과 재사용 가능한 프롬프트를 모읍니다.",
  },
  "ai-assistant": {
    headline: { accent: "AI & 자동화", title: "어시스턴트" },
    description:
      "사내 데이터(사고·인수인계·TIP·백업·연락처·서비스)를 자연어로 검색합니다. Gemini가 근거와 함께 답변합니다.",
  },
  automations: {
    headline: { accent: "AI & 자동화", title: "자동화실행" },
    description:
      "운영 자동화 작업을 수동으로 실행합니다. admin 전용 — quota를 소모하므로 신중히 사용합니다.",
  },
  settings: {
    headline: { accent: "관리", title: "시스템 설정" },
    description:
      "본인 프로필·권한·메일·외부 연동·시스템 정보를 한곳에서 확인합니다.",
  },
  "data-requests": {
    headline: { accent: "고객응대", title: "자료요청" },
    description: "담당 서비스의 대학 연락처로 자료 요청 메일을 발송합니다.",
  },
  mailbox: {
    headline: { accent: "고객응대", title: "메일함" },
    description:
      "본인 Outlook 수신함을 확인하고 AI 회신 초안을 검토·발송합니다.",
  },
};
