/**
 * 잘못 올린 영수증을 지울 수 있는가.
 *
 * 순수 함수로 둔 이유는 upload-guard 와 같다 — 액션 안에 묻으면 "확정건을 지우려
 * 했을 때" 같은 경우를 테스트할 수 없다.
 */

export type DeleteVerdict = { ok: true } | { ok: false; reason: string };

type Actor = {
  permission: "admin" | "member" | "viewer" | null;
  displayName: string;
};

type Receipt = {
  uploadedBy: string;
  confirmedAt: string | null;
};

export function canDeleteReceipt(me: Actor, receipt: Receipt): DeleteVerdict {
  if (me.permission === "viewer") {
    return { ok: false, reason: "읽기 전용 권한입니다" };
  }

  // 확정하면 전도금 엑셀에 한 줄이 들어간다. 그 줄은 화면에서 지울 방법이 없고
  // (사람이 엑셀에서 직접 지워야 한다), 영수증을 지우면 그 줄의 근거가 사라진다.
  // admin 도 예외가 아니다 — 권한이 아니라 순서의 문제다.
  if (receipt.confirmedAt) {
    return {
      ok: false,
      reason: "확정한 영수증은 지울 수 없습니다 (전도금 장부에 기록됨)",
    };
  }

  // 판독 중은 막지 않는다. 폴러가 꺼져 있으면 '읽는 중'에서 멈춘 채 영영 못 지우게
  // 되는데, 실제로 그 상태의 행이 화면에 남아 있었다.

  if (me.permission === "admin") return { ok: true };

  if (receipt.uploadedBy !== me.displayName) {
    return { ok: false, reason: "올린 사람만 지울 수 있습니다" };
  }
  return { ok: true };
}
