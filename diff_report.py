# -*- coding: utf-8 -*-
"""이전 forests.json 과 새 forests.json 을 대조해 무엇이 바뀌었는지 보고한다.

    python3 diff_report.py <old.json> <new.json>

보고서는 stdout, 중단 사유는 stderr, 판정은 종료 코드로 넘긴다.

    0   정상, 바뀐 게 있음        -> 커밋한다
    10  바뀐 게 없음              -> 커밋하지 않는다
    20  자료가 급감함             -> 갱신을 중단한다

휴양림 수는 거의 변하지 않는다. 갑자기 줄었다면 수집이 덜 된 것이지 휴양림이
사라진 게 아니므로, 그 상태로 배포해 휴양림이 조용히 사라지는 일을 막는다.
"""

import json
import sys

SHRINK_LIMIT = 0.9      # 이전의 90% 미만이면 급감으로 본다
MAX_LINES = 10          # 항목당 최대 이 개수까지만 나열한다


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def index(doc):
    """id -> 비교할 값들. 이름·예약방식·경쟁률이 바뀌면 화면이 달라진다."""
    out = {}
    for r in doc.get("휴양림", []):
        out[r["id"]] = {
            "이름": r["이름"],
            "지역": f"{r.get('시도', '')} {r.get('시군구', '')}".strip(),
            "예약": r["예약"],
            "경쟁률": r.get("경쟁률"),
            "별점": r.get("별점"),
        }
    return out


def 나열(제목, 줄들, out):
    if not 줄들:
        return
    out.append("")
    out.append(제목)
    for s in 줄들[:MAX_LINES]:
        out.append(f"  {s}")
    if len(줄들) > MAX_LINES:
        out.append(f"  … 외 {len(줄들) - MAX_LINES:,}곳")


def main(old_path, new_path):
    new = load(new_path)
    cur = index(new)
    예약라벨 = new.get("예약라벨", [])

    총 = len(cur)
    휴양림수 = sum(1 for r in new.get("휴양림", []) if r.get("구분") == 0)
    경쟁률수 = sum(1 for v in cur.values() if v["경쟁률"] is not None)
    인기도수 = sum(1 for v in cur.values() if v["별점"] is not None)

    머리 = (f"합계 {총:,}곳 — 자연휴양림 {휴양림수:,} · "
            f"공식 경쟁률 {경쟁률수:,} · 인기도 {인기도수:,}")

    try:
        prev = index(load(old_path))
    except (OSError, ValueError):
        # 첫 실행이거나 이전 파일이 깨졌다. 막지 않고 요약만 남긴다.
        print(머리)
        print("이전 자료가 없어 비교를 건너뜁니다.")
        return 0

    if prev and 총 < len(prev) * SHRINK_LIMIT:
        print(머리)
        print(f"이전 {len(prev):,}곳 -> 이번 {총:,}곳", file=sys.stderr)
        return 20

    신규 = [k for k in cur if k not in prev]
    삭제 = [k for k in prev if k not in cur]
    예약변경, 경쟁률변경, 인기도변경 = [], [], []
    for k, v in cur.items():
        p = prev.get(k)
        if not p:
            continue
        if p["예약"] != v["예약"]:
            예약변경.append(
                f"{v['이름']} ({v['지역']}) : "
                f"{예약라벨[p['예약']] if p['예약'] < len(예약라벨) else p['예약']}"
                f" -> {예약라벨[v['예약']] if v['예약'] < len(예약라벨) else v['예약']}")
        if p["경쟁률"] != v["경쟁률"]:
            경쟁률변경.append(f"{v['이름']} ({v['지역']}) : {p['경쟁률']} -> {v['경쟁률']}")
        if p["별점"] != v["별점"]:
            인기도변경.append(f"{v['이름']} ({v['지역']}) : {p['별점']} -> {v['별점']}")

    바뀐것 = len(신규) + len(삭제) + len(예약변경) + len(경쟁률변경) + len(인기도변경)

    out = [머리,
           f"신규 {len(신규):,}곳 · 삭제 {len(삭제):,}곳 · "
           f"예약방식 변경 {len(예약변경):,} · 경쟁률 변경 {len(경쟁률변경):,} · "
           f"인기도 변경 {len(인기도변경):,}"]
    나열("새로 생긴 곳", [f"{cur[k]['이름']} ({cur[k]['지역']})" for k in 신규], out)
    나열("사라진 곳", [f"{prev[k]['이름']} ({prev[k]['지역']})" for k in 삭제], out)
    나열("예약 방식이 바뀐 곳", 예약변경, out)
    나열("공식 경쟁률이 바뀐 곳", 경쟁률변경, out)
    나열("인기도가 바뀐 곳", 인기도변경, out)

    print("\n".join(out))
    return 0 if 바뀐것 else 10


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
