# -*- coding: utf-8 -*-
"""숲나들e 관심(찜) 수 -> data/popularity.json

휴양림별로 숲나들e 이용자가 찍어 둔 '관심' 수를 모은다. 공식 경쟁률과는 성격이
다른 별개의 축이다. 경쟁률이 산림청이 매기는 미슐랭 스타라면 이쪽은 지도 별점에
가깝고, 예약 플랫폼 안에서 찍힌 값이라 예약 의도에 더 붙어 있다.

수집 방법이 조금 특이하다. 관심수를 주는 엔드포인트는 selectInsttInfoList.do
하나뿐인데 태그 검색 전용이고, 태그가 달린 휴양림은 전체의 3분의 1뿐이다.
그런데 이 엔드포인트는 srchTag 가 비면 **무작위 8곳**을 관심수와 함께 돌려준다.
그래서 빈 태그로 반복 호출해 모으면 자연휴양림 172곳이 전부 채워진다.
(쿠폰 수집가 문제라 뒤로 갈수록 느려진다. 400회쯤에서 더는 새로 안 나온다.)

끝내 안 나오는 13곳은 국립등산학교·동서트레일 같은 비휴양림 시설이다.
애초에 관심 기능이 없는 곳이라 빠져도 맞다.

키가 필요 없다. 실패해도 기존 popularity.json 을 그대로 두고 조용히 끝낸다.
인기도는 있으면 좋은 값이지, 없다고 배포를 막을 값은 아니다.
"""

import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar

BASE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(BASE, "data", "raw_forests.json")
OUT = os.path.join(BASE, "data", "popularity.json")

SITE = "https://www.foresttrip.go.kr"
MAIN = SITE + "/main.do?hmpgId=FRIP"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

DELAY = 0.3          # 요청 간격(초)
MAX_CALLS = 400      # 이보다 더 불러도 새로 나오는 곳이 없다
STALL = 60           # 연속 이만큼 새 휴양림이 안 나오면 다 모았다고 본다
RETRIES = 4


def request(op, url, data=None, ajax=True):
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    for attempt in range(RETRIES):
        req = urllib.request.Request(url, data=body)
        req.add_header("User-Agent", UA)
        req.add_header("Referer", MAIN)
        if ajax:
            req.add_header("X-Requested-With", "XMLHttpRequest")
        if body is not None:
            req.add_header("Content-Type",
                           "application/x-www-form-urlencoded; charset=UTF-8")
        try:
            with op.open(req, timeout=25) as res:
                return res.read().decode("utf-8", "replace")
        except (urllib.error.URLError, OSError):
            if attempt == RETRIES - 1:
                raise
            time.sleep(1.5 * (2 ** attempt) + random.random())
    raise RuntimeError("unreachable")


def main():
    try:
        with open(RAW, encoding="utf-8") as fp:
            facilities = json.load(fp)["시설"]
    except (OSError, ValueError):
        print(f"{RAW} 를 읽지 못해 인기도 수집을 건너뜁니다.")
        return 0

    목표 = {f["insttId"] for f in facilities if "자연휴양림" in f["별칭"]}
    이름 = {f["insttId"]: f["별칭"] for f in facilities}

    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
    try:
        home = request(op, MAIN, ajax=False)
        csrf = re.search(r"_csrf=([0-9a-f-]{36})", home).group(1)
    except Exception as e:
        print(f"세션을 못 잡아 인기도 수집을 건너뜁니다: {e}")
        return 0

    url = f"{SITE}/com/selectInsttInfoList.do?_csrf={csrf}"
    t0, 모은것, calls, 정체 = time.time(), {}, 0, 0

    while calls < MAX_CALLS and 정체 < STALL:
        calls += 1
        before = len(모은것)
        try:
            rows = json.loads(request(op, url, {"srchTag": ""})).get("result") or []
        except Exception as e:
            print(f"  {calls}회차 실패, 여기까지만 씁니다: {e}")
            break
        for x in rows:
            if x.get("intrsCnt") is not None:
                모은것[x["insttId"]] = x["intrsCnt"]
        정체 = 0 if len(모은것) > before else 정체 + 1
        if calls % 50 == 0:
            print(f"  {calls:3d}회 · 누적 {len(모은것):3d}곳", flush=True)
        time.sleep(DELAY)

    받은휴양림 = 목표 & set(모은것)
    if not 받은휴양림:
        print("한 곳도 못 받아 기존 자료를 그대로 둡니다.")
        return 0

    payload = {"수집일": time.strftime("%Y-%m-%d"), "출처": "숲나들e 관심(찜) 수",
               "시설": {k: {"관심": v} for k, v in 모은것.items()}}
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)

    빠진 = 목표 - set(모은것)
    상위 = sorted(((v, 이름.get(k, k)) for k, v in 모은것.items()
                  if k in 목표), reverse=True)[:10]

    print(f"\n완료: {len(모은것)}곳 (자연휴양림 {len(받은휴양림)}/{len(목표)}) · "
          f"{calls}회 호출 · {time.time() - t0:.0f}초 · {OUT}")
    print("관심 상위 10곳")
    for v, n in 상위:
        print(f"  {v:>6,}  {n}")
    if 빠진:
        print(f"못 받은 자연휴양림 {len(빠진)}곳: "
              f"{', '.join(이름.get(k, k) for k in list(빠진)[:10])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
