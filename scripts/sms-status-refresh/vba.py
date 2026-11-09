"""매크로 파트(`vbaProject.bin`) — 원본 바이트 되돌리기와 모듈 소스 해시.

출처: `SMS 발신번호 사전등록/moa_compare.py` 의 `vba_info`·`vba_sources`·`cmd_restore_vba`.
바뀐 것: 경로를 `Path` 로 받고, 프로그램 종료 대신 `StepFailure("verify_failed")`,
**oletools 가 없을 때 검사를 생략하지 않고 ImportError 를 그대로 올린다** — 생략하면
매크로가 바뀌었는지 모른 채 '통과' 로 올라간다.

Excel COM 이 다시 저장하면 매크로 프로젝트가 다시 직렬화된다. 그래서 06·07 을 쓴 뒤
이 파트만 원본 바이트로 바꿔 끼운다. 다른 파트는 바이트·압축 방식을 그대로 옮긴다.
이 파일은 통합 문서를 openpyxl 로 저장하지 않는다 — zip 파트 교체뿐이다.
"""
from __future__ import annotations

import hashlib
import os
import tempfile
import zipfile
from pathlib import Path

from contract import StepFailure


def _vba_name(z: zipfile.ZipFile) -> str | None:
    return next((n for n in z.namelist() if n.lower().endswith("vbaproject.bin")), None)


def vba_part(path: Path) -> tuple[str, bytes] | None:
    """(파트 이름, 바이트). 매크로 파트가 없으면 None."""
    with zipfile.ZipFile(path) as z:
        name = _vba_name(z)
        return None if name is None else (name, z.read(name))


def restore_vba(before: Path, after: Path) -> tuple[int, int]:
    """after 의 매크로 파트를 before 의 원본 바이트로 바꾼다. (바꾸기 전 크기, 바꾼 뒤 크기).

    같은 폴더 임시 파일에 다 쓴 뒤 os.replace 로 바꿔 끼운다(같은 볼륨이라 Windows 에서도 원자적).
    중간에 실패하면 after 는 그대로다.
    """
    original = vba_part(before)
    if original is None:
        raise StepFailure("verify_failed", "원본에 매크로 파트 없음")
    vba_name, data = original
    with zipfile.ZipFile(after) as za:
        if vba_name not in za.namelist():
            raise StepFailure("verify_failed", "작업 사본에 매크로 파트 없음")
        old_size = za.getinfo(vba_name).file_size
        fd, tmp = tempfile.mkstemp(suffix=".xlsm", dir=Path(after).resolve().parent)
        os.close(fd)
        try:
            with zipfile.ZipFile(tmp, "w") as out:
                for info in za.infolist():
                    part = data if info.filename == vba_name else za.read(info.filename)
                    out.writestr(info, part, compress_type=info.compress_type)
        except BaseException:
            os.unlink(tmp)
            raise
    os.replace(tmp, after)
    return old_size, len(data)


def vba_module_hashes(path: Path) -> dict[str, str]:
    """모듈 이름 → 소스 sha256. oletools 가 없으면 ImportError 를 그대로 올린다(삼키지 않는다)."""
    from oletools.olevba import VBA_Parser

    vp = VBA_Parser(str(path), data=Path(path).read_bytes())
    try:
        return {
            name: hashlib.sha256(code if isinstance(code, bytes) else code.encode("utf-8", "replace")).hexdigest()
            for _, _, name, code in vp.extract_macros()
        }
    finally:
        vp.close()
