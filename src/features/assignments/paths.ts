/**
 * 원장이 바뀌면 함께 낡는 화면들.
 *
 * **배정 원장은 두 화면을 떠받친다** — 총괄장 `대학배정`(누가 무엇을 맡고 있는가)과
 * 관리 `업무배정`(배분현황·제안·신규배정). #1205 가 라우트를 나눈 뒤 server action
 * 넷이 옛 주소만 다시 그려서, 제안을 승인해도 제안 탭은 그대로 pending 으로 보이고
 * 배정을 고쳐도 배분현황의 대학 수가 예전 값으로 남았다.
 *
 * 주소를 여기 모아 두는 이유는 **다음에 라우트가 또 움직일 때 고칠 곳이 한 곳**이기
 * 때문이다. 그때 놓치면 화면은 멀쩡해 보이고 숫자만 낡는다 — 에러가 안 난다.
 */
export const ASSIGNMENTS_PATH = "/dashboard/assignments";
export const WORK_ASSIGNMENT_PATH = "/dashboard/work-assignment";
