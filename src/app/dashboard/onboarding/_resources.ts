import type { GuideSection } from "../_components/patterns/GuidePattern";

/**
 * /dashboard/onboarding 자료실 탭 정적 콘텐츠.
 * 신입이 자주 찾는 외부 도구·문서·매뉴얼 링크를 모은다.
 *
 * url 채우는 법:
 *   - url 비어있으면 텍스트만 표시 (링크 X)
 *   - url 채우면 새 탭으로 열림 (↗ 아이콘 자동 표시)
 *   - 권한 필요한 사내 URL도 그대로 기재 (운영자만 클릭 시 정상 진입)
 *
 * 추후 DB로 이전 시 이 파일이 절단점.
 */
export const onboardingResources: GuideSection[] = [
  {
    ico: "①",
    title: "사내 시스템",
    description: "운영부 일상 업무에 사용하는 사내 도구",
    items: [
      {
        title: "OPS Console",
        detail: "본 대시보드 — 운영 통합 콘솔",
        url: "/dashboard",
      },
      {
        title: "내부관리자 페이지",
        detail: "회원·서비스·신청 관리",
        url: "",
      },
      {
        title: "성적산출 페이지",
        detail: "수시/정시 내신·수능 성적산출",
        url: "",
      },
      {
        title: "대학관리자 페이지",
        detail: "대학별 페이지 관리",
        url: "",
      },
      {
        title: "생성툴",
        detail: "공통원서 페이지 생성 도구",
        url: "",
      },
    ],
  },
  {
    ico: "②",
    title: "운영 문서 (SharePoint · Drive)",
    description: "상시 작성·조회하는 시트와 문서",
    items: [
      {
        title: "계약 진행 시트",
        detail: "4년제·전문대·초중고·대학원·기타 5 시트",
        url: "",
      },
      {
        title: "미수 채권 시트",
        detail: "미수 채권 관리 — 운영자 컬럼 기준 본인 분 추출",
        url: "",
      },
      {
        title: "정산 결의서 양식",
        detail: "운영자 지출결의 + 전표 발행 템플릿",
        url: "",
      },
      {
        title: "일일 보고 양식",
        detail: "시프트 종료 시 일일 보고",
        url: "",
      },
    ],
  },
  {
    ico: "③",
    title: "매뉴얼 · 가이드",
    description: "직무 매뉴얼과 표준 운영 절차",
    items: [
      {
        title: "운영부 위키 (Notion)",
        detail: "조직 소개·정책·FAQ",
        url: "",
      },
      {
        title: "오즈 리포트 디자이너 매뉴얼",
        detail: "출력물 제작 표준 매뉴얼",
        url: "",
      },
      {
        title: "엔터사이트 구조 가이드",
        detail: "엔터 파일 업로드 세팅 표준",
        url: "",
      },
      {
        title: "PIMS 사용법",
        detail: "합격자통합관리시스템 가이드",
        url: "",
      },
    ],
  },
  {
    ico: "④",
    title: "고객 응대 · 콜",
    description: "학부모·대학 응대 관련 도구",
    items: [
      {
        title: "콜프로그램 (인입콜)",
        detail: "1:1 게시판 + 통화 기록",
        url: "",
      },
      {
        title: "1:1 게시판 응대 매뉴얼",
        detail: "응대 표준 문구·예외 처리",
        url: "",
      },
    ],
  },
  {
    ico: "⑤",
    title: "참고 사이트",
    description: "입시·진학 외부 정보",
    items: [
      {
        title: "진학어플라이 (대고객 사이트)",
        detail: "서비스 본 사이트 — 사용자 관점 확인",
        url: "https://jinhakapply.com",
      },
      {
        title: "한국대학교육협의회",
        detail: "대학입학전형 일정·정책",
        url: "https://www.kcue.or.kr",
      },
    ],
  },
];
