# -*- coding: utf-8 -*-
"""네이버 검색 API -> data/popularity.json

휴양림별 블로그·카페 게시물 수를 모은다. "얼마나 회자되는가"를 재는 값이고,
산림청이 발표하는 공식 경쟁률과는 성격이 다른 별개의 축이다.
(식당으로 치면 경쟁률이 미슐랭 스타, 이쪽이 지도 별점에 해당한다.)

검색어는 지자체명이 붙지 않은 정식명칭을 쓴다. '(강릉시)대관령자연휴양림' 으로
검색하면 괄호 때문에 결과가 거의 안 잡히고, '대관령' 처럼 짧게 자르면 휴양림과
무관한 글까지 섞인다. '대관령자연휴양림' 이 가장 정확하다.

자격증명이 없으면 오류 없이 그냥 종료한다. 인기도는 있으면 좋은 값이지,
없다고 배포를 막을 값은 아니다.
  export NAVER_CLIENT_ID=...
  export NAVER_CLIENT_SECRET=...
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

BASE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(BASE, "data", "raw_forests.json")
OUT = os.path.join(BASE, "data", "popularity.json")

API = "https://openapi.naver.com/v1/search/{}.json?query={}&display=1"
DELAY = 0.2          # 초당 5건. 일 한도 25,000건 대비 한참 여유가 있다
RETRIES = 4


def 검색어(f):
    """'(강릉시)대관령자연휴양림' -> '대관령자연휴양림'"""
    s = re.sub(r"^\([^)]*\)", "", f["별칭"] or "").strip()
    return s or (f.get("이름") or "").strip()


def total(kind, query, cid, secret):
    """네이버 검색 결과 총 건수. 실패하면 백오프 후 재시도하고, 끝내 안 되면 None."""
    url = API.format(kind, urllib.parse.quote(query))
    for attempt in range(RETRIES):
        req = urllib.request.Request(url)
        req.add_header("X-Naver-Client-Id", cid)
        req.add_header("X-Naver-Client-Secret", secret)
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                return json.loads(res.read().decode()).get("total")
        except urllib.error.HTTPError as e:
            if e.code in (401, 403):                # 자격증명 문제는 재시도해도 소용없다
                raise SystemExit(f"[중단] 네이버 인증 실패({e.code}). "
                                 f"NAVER_CLIENT_ID/SECRET 을 확인하세요.")
            if attempt == RETRIES - 1:
                return None
            time.sleep(1.5 * (2 ** attempt) + random.random())
        except (urllib.error.URLError, OSError):
            if attempt == RETRIES - 1:
                return None
            time.sleep(1.5 * (2 ** attempt) + random.random())
    return None


def main():
    cid = os.environ.get("NAVER_CLIENT_ID")
    secret = os.environ.get("NAVER_CLIENT_SECRET")
    if not cid or not secret:
        print("NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 이 없어 인기도 수집을 건너뜁니다.")
        print("  https://developers.naver.com/apps/#/register 에서 '검색' API 로 발급받으세요.")
        return 0

    with open(RAW, encoding="utf-8") as fp:
        facilities = json.load(fp)["시설"]

    t0 = time.time()
    out, 실패 = {}, []
    for i, f in enumerate(facilities, 1):
        q = 검색어(f)
        b = total("blog", q, cid, secret)
        time.sleep(DELAY)
        c = total("cafearticle", q, cid, secret)
        time.sleep(DELAY)
        if b is None and c is None:
            실패.append(q)
            continue
        out[f["insttId"]] = {"검색어": q, "블로그": b or 0, "카페": c or 0}
        if i % 40 == 0:
            print(f"  {i:3d}/{len(facilities)}", flush=True)

    payload = {"수집일": time.strftime("%Y-%m-%d"), "시설": out}
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)

    상위 = sorted(out.items(), key=lambda kv: -(kv[1]["블로그"] + kv[1]["카페"]))[:10]
    print(f"\n완료: {len(out)}곳 · {time.time() - t0:.0f}초 · {OUT}")
    print("언급량 상위 10곳")
    for _, v in 상위:
        print(f"  {v['검색어']:24s} 블로그 {v['블로그']:>7,} · 카페 {v['카페']:>7,}")
    if 실패:
        print(f"수집 실패 {len(실패)}곳: {', '.join(실패[:10])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
