import type { Department } from "./schemas";

type TemplateItem = { department: Department; category: string; title: string };

export const CHECKLIST_TEMPLATE: TemplateItem[] = [
  // 기획파트
  { department: "기획파트", category: "사이트(PC/M)", title: "PC/M 광고배너 노출 상태" },
  { department: "기획파트", category: "사이트(PC/M)", title: "PC/M 주요 화면·기능 동작" },
  { department: "기획파트", category: "사이트(PC/M)", title: "M 메인 인기경쟁률 노출 로직 확인" },
  { department: "기획파트", category: "사이트(PC/M)", title: "M 대학별 프로그램 노출 로직 확인" },
  { department: "기획파트", category: "사이트(PC/M)", title: "페이지 리얼배포 여부 확인 및 오류 모니터링" },
  // 운영부
  { department: "운영부", category: "접수 서비스", title: "전체 서비스 테스트오픈 완료" },
  { department: "운영부", category: "접수 서비스", title: "접수기간 당직자 배정" },
  { department: "운영부", category: "결제사", title: "결제사 비상연락망 요청" },
  { department: "운영부", category: "결제사", title: "결제사 세팅" },
  { department: "운영부", category: "매출", title: "접수건수 예측(수시/정시)" },
  { department: "운영부", category: "정산", title: "진학캐쉬 추가 환불 일정 재경팀 협의·공유" },
  { department: "운영부", category: "대교협", title: "대교협 데이터 검증계획서 작성" },
  { department: "운영부", category: "대교협", title: "대교협 비상연락망 작성·공유" },
  { department: "운영부", category: "대교협", title: "대교협 서비스목록·대학인증서 목록 전달" },
  { department: "운영부", category: "대교협", title: "고교DB 업데이트" },
  { department: "운영부", category: "스마트경쟁률", title: "경쟁률 URL 리스트 생성·리스트업" },
  // 고객지원팀
  { department: "고객지원팀", category: "콘텐츠", title: "콘텐츠 제작·배포 관리(카드뉴스 등)" },
  { department: "고객지원팀", category: "고객센터 운영", title: "상담 인력 채용·배정" },
  { department: "고객지원팀", category: "고객센터 운영", title: "PC·상담좌석 환경 세팅" },
  { department: "고객지원팀", category: "고객센터 운영", title: "상담원 교육·계정 세팅" },
  { department: "고객지원팀", category: "고객센터 운영", title: "상위 20개 주요대학 원서 TEST" },
  // 개발부
  { department: "개발부", category: "서버/시스템", title: "원서접수 고등학교 데이터 업데이트 확인" },
  { department: "개발부", category: "서버/시스템", title: "PG 결제사 비율별 분배 후 세팅" },
  { department: "개발부", category: "서버/시스템", title: "대학교 인증서 최신 업데이트 검증" },
  { department: "개발부", category: "서버/시스템", title: "경쟁률 생성 프로세스 정상 동작 확인" },
  { department: "개발부", category: "서버/시스템", title: "웹 서버 동작 확인(PC/모바일)" },
  { department: "개발부", category: "서버/시스템", title: "운영 서버 페이지 배포 확인" },
  { department: "개발부", category: "모니터링", title: "모니터링 서버 준비 확인(Grafana)" },
  // 영업부
  { department: "영업부", category: "입학홈페이지", title: "대학 원서접수 일정정리·합격발표 페이지 업데이트" },
  { department: "영업부", category: "입학홈페이지", title: "접수준비 인트로 페이지 셋팅" },
  { department: "영업부", category: "입학홈페이지", title: "메인페이지 팝업·레이어팝업 셋팅" },
  { department: "영업부", category: "입학홈페이지", title: "메인페이지 메인 이미지 제작" },
];
