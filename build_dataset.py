# -*- coding: utf-8 -*-
"""data/raw_forests.json + competition.json + popularity.json -> forests.json

화면이 바로 먹을 수 있는 형태로 가공한다. 네트워크는 쓰지 않는다.

여기서 결정하는 것 세 가지:

1. 시설구분 — 숲나들e 목록 199곳에는 자연휴양림이 아닌 시설 27곳
   (국립등산학교·산악박물관·동서트레일·산림레포츠파크·숲체험장 등)이 섞여 있다.
   버리지 않고 구분해서 담고, 화면 기본값만 자연휴양림으로 둔다.

2. 예약방식 — 숲나들e 추첨 이용안내(/rep/drlts/drltsUseGdnc.do)에 적힌 규칙을
   유형별로 옮긴다. 국립 자연휴양림은 선착순과 추첨을 함께 쓰고, 아세안휴양림만
   아세안 10개국 외국인 우선예약 정책 때문에 추첨에서 빠진다.

3. 특징 태그 — 숲나들e 자체 태그는 199곳 중 67곳에만 붙어 있어 필터로 쓰기엔
   모자란다. 소개글과 이름에서 키워드를 뽑아 채운다. 원본 태그가 있으면 함께 쓴다.

경쟁률은 공식 발표가 상위 5곳뿐이라 나머지는 null 로 둔다. 추정값을 만들지 않는다.
"""

import datetime
import json
import math
import os
import re
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(BASE, "data", "raw_forests.json")
COMP = os.path.join(BASE, "data", "competition.json")
POP = os.path.join(BASE, "data", "popularity.json")
OUT = os.path.join(BASE, "forests.json")

SOURCE = "숲나들e(foresttrip.go.kr) · 산림청 국립자연휴양림관리소 · 네이버 검색"

구분_휴양림, 구분_기타 = 0, 1
구분_라벨 = ["자연휴양림", "그 외 산림휴양시설"]

예약_라벨 = ["선착순 + 추첨", "선착순", "휴양림별 상이", "개별 예약"]
예약_선착순추첨, 예약_선착순, 예약_상이, 예약_개별 = 0, 1, 2, 3

# 아세안휴양림은 아세안 10개국 출신 외국인 우선예약 정책에 따라 추첨 대상에서 빠진다.
추첨제외 = ["아세안"]

# 특징 태그. 소개글과 이름에서 찾는다. 앞에 오는 규칙이 먼저 걸린다.
# 값은 (태그명, [찾을 키워드]) — 키워드가 하나라도 있으면 그 태그를 붙인다.
특징 = [
    ("계곡",       ["계곡", "물놀이장", "폭포"]),
    ("바다·섬",    ["바다", "해변", "해안", "해수욕", "낙조", "섬 ", "섬의", "도서"]),
    ("물놀이",     ["물놀이", "수영장", "워터", "물놀이장"]),
    ("편백·삼림욕", ["편백", "피톤치드", "삼림욕", "산림욕"]),
    ("소나무·잣나무", ["소나무", "잣나무", "금강송", "낙엽송", "송림"]),
    ("단풍·가을",  ["단풍", "억새", "가을"]),
    ("야영·캠핑",  ["야영", "캠핑", "카라반", "글램핑", "오토캠핑", "데크"]),
    ("등산·트레킹", ["등산", "트레킹", "등산로", "탐방로", "종주"]),
    ("산책로",     ["산책로", "둘레길", "데크로드", "무장애", "산책"]),
    ("아이동반",   ["놀이터", "어린이", "아이들", "가족", "유아", "키즈"]),
    ("치유·힐링",  ["치유", "힐링", "명상", "휴식", "재충전"]),
    ("전망·조망",  ["전망", "조망", "일출", "일몰", "운해", "경관이"]),
    ("호수·저수지", ["호수", "저수지", "댐"]),
    ("온천",       ["온천", "스파"]),
    ("체험·프로그램", ["체험", "프로그램", "교육", "학습"]),
]


def hhmm(v):
    """'150000' -> '15:00'. 값이 이상하면 빈 문자열."""
    s = (v or "").strip()
    if len(s) < 4 or not s.isdigit():
        return ""
    return f"{s[:2]}:{s[2:4]}"


def 고유명(별칭):
    """'(고성군)진부령자연휴양림' -> '진부령'

    경쟁률 발표는 고유명만 쓰기 때문에(진부령, 대야산…) 앞뒤를 벗겨 맞춘다.
    """
    s = re.sub(r"^\([^)]*\)", "", 별칭 or "").strip()
    s = re.sub(r"\s*자연휴양림$", "", s)
    return s.strip()


def 시설구분(별칭):
    return 구분_휴양림 if "자연휴양림" in (별칭 or "") else 구분_기타


def 예약방식(유형, 구분, 별칭):
    if 유형 == "국립":
        if 구분 != 구분_휴양림:
            return 예약_선착순                      # 트레일·박물관·야영장은 추첨 대상이 아니다
        if any(k in 별칭 for k in 추첨제외):
            return 예약_선착순
        return 예약_선착순추첨
    if 유형 == "공립":
        return 예약_상이                            # 월추첨·지역주민추첨은 지자체마다 다르다
    return 예약_개별


def 특징태그(f):
    """소개글 + 이름에서 특징을 뽑고, 숲나들e 원본 태그를 얹는다."""
    본문 = (f.get("소개") or "") + " " + (f.get("이름") or "") + " " + (f.get("별칭") or "")
    out = []
    for 이름, 키워드들 in 특징:
        if any(k in 본문 for k in 키워드들):
            out.append(이름)
    for t in (f.get("태그") or []):                 # 원본 태그는 그대로 보존
        t = t.strip()
        if t and t not in out:
            out.append(t)
    return out


def load(path, default=None):
    try:
        with open(path, encoding="utf-8") as fp:
            return json.load(fp)
    except (OSError, ValueError):
        return default


def 별점(블로그, 카페, 최소log, 최대log):
    """언급량을 0~5 별점으로. 자릿수 차이가 커서 로그를 씌운 뒤 정규화한다.

    별점만 남기면 근거가 사라지므로 원시 건수도 함께 내보낸다.
    """
    if 블로그 is None:
        return None
    v = math.log10((블로그 or 0) + (카페 or 0) + 1)
    if 최대log <= 최소log:
        return 2.5
    r = (v - 최소log) / (최대log - 최소log) * 5
    return round(r * 2) / 2                         # 0.5 단위로 맞춘다


def main():
    raw = load(RAW)
    if not raw:
        raise SystemExit(f"[중단] {RAW} 를 읽지 못했습니다. crawl_forest.py 를 먼저 실행하세요.")
    facilities = raw["시설"]

    comp = load(COMP, {})
    pop = load(POP, {})
    pop_by_id = (pop.get("시설") or {})

    # --- 경쟁률 이름 대조 -------------------------------------------------
    comp_map = {c["이름"]: c["경쟁률"] for c in (comp.get("휴양림별") or [])}
    matched = set()

    # --- 인기도 정규화 기준 ----------------------------------------------
    합계들 = [(p.get("블로그") or 0) + (p.get("카페") or 0)
             for p in pop_by_id.values() if p.get("블로그") is not None]
    최소log = math.log10(min(합계들) + 1) if 합계들 else 0
    최대log = math.log10(max(합계들) + 1) if 합계들 else 0

    권역들 = []
    # 특징 태그를 먼저 깔아 둔다. 뒤에 붙는 숲나들e 원본 태그와 섞이면 화면에서
    # '등산'·'등산로'·'등산·트레킹' 처럼 비슷한 칩이 나란히 서기 때문에,
    # 필터 칩에는 앞쪽 특징만 쓰고 원본 태그는 상세 화면에만 보여 준다.
    태그들 = [이름 for 이름, _ in 특징]
    특징수 = len(태그들)
    records = []

    for f in facilities:
        구분 = 시설구분(f["별칭"])
        유형 = f["유형"]
        방식 = 예약방식(유형, 구분, f["별칭"])

        if f["권역"] not in 권역들:
            권역들.append(f["권역"])
        tags = 특징태그(f)
        for t in tags:
            if t not in 태그들:
                태그들.append(t)

        기본명 = 고유명(f["별칭"])
        경쟁 = comp_map.get(기본명)
        if 경쟁 is not None:
            matched.add(기본명)

        p = pop_by_id.get(f["insttId"], {})
        블로그, 카페 = p.get("블로그"), p.get("카페")

        records.append({
            "id": f["insttId"],
            "이름": f["이름"] or f["별칭"],
            "별칭": f["별칭"],
            "구분": 구분,
            "유형": ["국립", "공립", "사립"].index(유형) if 유형 in ("국립", "공립", "사립") else -1,
            "권역": 권역들.index(f["권역"]),
            "시도": f["시도"],
            "시군구": f["시군구"],
            "y": round(f["위도"], 6) if f.get("위도") else None,
            "x": round(f["경도"], 6) if f.get("경도") else None,
            "주소": f.get("주소") or "",
            "전화": f.get("전화") or "",
            "입실": hhmm(f.get("입실")),
            "퇴실": hhmm(f.get("퇴실")),
            "수용": f.get("최대수용") or 0,
            "개장": f.get("개장년도") or "",
            "소개": f.get("소개") or "",
            "태그": [태그들.index(t) for t in tags],
            "예약": 방식,
            "경쟁률": 경쟁,
            "블로그": 블로그,
            "카페": 카페,
            "별점": 별점(블로그, 카페, 최소log, 최대log),
            "홈": f.get("홈페이지") or "",
        })

    # 경쟁률이 안 붙은 발표 항목은 반드시 눈에 띄게 남긴다. 이름 표기가 바뀌면
    # 조용히 사라져서 "미발표"로 보이게 되는데, 그건 사실과 다르다.
    미대조 = [n for n in comp_map if n not in matched]
    if 미대조:
        print(f"[경고] 경쟁률 발표 {len(미대조)}건이 휴양림과 대조되지 않았습니다: "
              f"{', '.join(미대조)}")

    payload = {
        "updated": datetime.date.today().isoformat(),
        "수집일시": raw.get("수집일시", ""),
        "source": SOURCE,
        "구분라벨": 구분_라벨,
        "유형라벨": ["국립", "공립", "사립"],
        "권역라벨": 권역들,
        "예약라벨": 예약_라벨,
        "태그라벨": 태그들,
        "특징태그수": 특징수,
        "경쟁률자료": comp,
        "인기도수집일": pop.get("수집일", ""),
        "휴양림": records,
    }

    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)

    # --- 사람이 눈으로 보는 리포트 ---------------------------------------
    import collections
    c구분 = collections.Counter(구분_라벨[r["구분"]] for r in records)
    c유형 = collections.Counter(payload["유형라벨"][r["유형"]] for r in records if r["유형"] >= 0)
    c예약 = collections.Counter(예약_라벨[r["예약"]] for r in records)
    c권역 = collections.Counter(권역들[r["권역"]] for r in records)
    휴양림만 = [r for r in records if r["구분"] == 구분_휴양림]
    c휴양림유형 = collections.Counter(payload["유형라벨"][r["유형"]] for r in 휴양림만 if r["유형"] >= 0)

    print(f"\n총 {len(records)}곳")
    print("  시설구분 :", " · ".join(f"{k} {v}" for k, v in c구분.items()))
    print("  자연휴양림:", " · ".join(f"{k} {v}" for k, v in c휴양림유형.items()))
    print("  유형     :", " · ".join(f"{k} {v}" for k, v in c유형.items()))
    print("  예약방식 :", " · ".join(f"{k} {v}" for k, v in c예약.items()))
    print("  권역     :", " · ".join(f"{k} {v}" for k, v in sorted(c권역.items())))
    print(f"  공식 경쟁률 : {sum(1 for r in records if r['경쟁률'] is not None)}곳 "
          f"(발표 {len(comp_map)}건)")
    print(f"  인기도      : {sum(1 for r in records if r['별점'] is not None)}곳")
    print(f"  태그 {len(태그들)}종 (특징 {특징수} + 원본 {len(태그들) - 특징수}) · "
          f"태그 없는 곳 {sum(1 for r in records if not r['태그'])}곳")
    print(f"  좌표 없음 {sum(1 for r in records if r['y'] is None)}곳")
    print(f"\n출력: {OUT} ({os.path.getsize(OUT) / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
