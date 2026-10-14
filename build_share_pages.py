# -*- coding: utf-8 -*-
"""forests.json -> f/<휴양림id>/index.html

공유 링크의 미리보기에 그 휴양림 사진이 뜨게 하는 작은 HTML 들을 찍어낸다.

카카오톡·페이스북 크롤러는 자바스크립트를 돌리지 않는다. 우리 사이트는
?f=<id> 를 읽어 상세를 여는 일을 브라우저에서 하므로, 크롤러에게는 어떤 주소든
같은 index.html 로 보이고 미리보기도 늘 같았다.

그래서 휴양림마다 머리말만 다른 HTML 을 미리 만들어 둔다.
  - 크롤러는 <head> 만 읽고 그 휴양림 사진·이름으로 미리보기를 만든다.
    스크립트를 안 돌리니 리다이렉트도 따라가지 않는다.
  - 사람은 열자마자 본체로 넘어가 평소처럼 상세를 본다.
  - noindex 를 붙여 검색엔진에는 걸리지 않게 한다. 공유용이지 읽을거리가 아니다.

본체로 돌아가는 경로는 ../../ 로 잡는다. GitHub Pages 는 저장소 이름이 경로에
붙어서(/forest-trip-map/) 절대경로를 쓰면 엉뚱한 데로 간다.
"""

import html
import json
import os
import shutil
import sys

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, "forests.json")
OUT = os.path.join(BASE, "f")

SITE = "https://forest-trip-map.vercel.app"
FALLBACK_IMAGE = f"{SITE}/og.png"
IMAGE_RS = 1200          # CDN 이 내어주는 크기. 1200x899 로 OG 권장(1200x630)을 넘는다

PAGE = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — 전국 자연휴양림 한눈에</title>
<meta name="description" content="{desc}">
<meta name="robots" content="noindex, follow">
<link rel="icon" type="image/png" sizes="32x32" href="../../icon-32.png">

<meta property="og:type" content="article">
<meta property="og:site_name" content="전국 자연휴양림 한눈에">
<meta property="og:locale" content="ko_KR">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:image" content="{image}">
<meta property="og:image:alt" content="{title} 전경">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{image}">

<script>location.replace("../../?f={qid}");</script>
<style>
  body{{margin:0;min-height:100vh;display:grid;place-items:center;
       font-family:system-ui,-apple-system,sans-serif;color:#2E3440;background:#F2F5F4}}
  a{{color:#1e9575;font-size:15px;font-weight:600}}
</style>
</head>
<body>
<p><a href="../../?f={qid}">{title} 보기</a></p>
</body>
</html>
"""


def 설명(r, D):
    """미리보기 한 줄. 어디에 있고, 어떻게 예약하고, 얼마나 치열한지."""
    앞 = [v for v in (
        f"{D['권역라벨'][r['권역']] if r['권역'] >= 0 else ''} {r['시군구']}".strip(),
        D["유형라벨"][r["유형"]] if r["유형"] >= 0 else "",
        D["예약라벨"][r["예약"]],
    ) if v]
    뒤 = []
    if r.get("경쟁률") is not None:
        해 = D.get("경쟁률자료", {}).get("기준연도", "")
        뒤.append(f"{해} 성수기 공식 경쟁률 {r['경쟁률']}:1")
    if r.get("관심"):
        뒤.append(f"관심 {r['관심']:,}명")
    s = " · ".join(앞)
    if 뒤:
        s += " — " + ", ".join(뒤)
    return s


def main():
    try:
        with open(SRC, encoding="utf-8") as fp:
            D = json.load(fp)
    except (OSError, ValueError):
        raise SystemExit(f"[중단] {SRC} 를 읽지 못했습니다. build_dataset.py 를 먼저 실행하세요.")

    대상 = [r for r in D["휴양림"] if r["구분"] == 0]
    cdn = D.get("이미지CDN", "")

    남길것 = set()
    사진있음 = 0
    for r in 대상:
        qid = r["id"]
        if r.get("사진") and cdn:
            image = f"{cdn}{r['사진']}?rs={IMAGE_RS}"
            사진있음 += 1
        else:
            image = FALLBACK_IMAGE
        page = PAGE.format(
            title=html.escape(r["이름"], quote=True),
            desc=html.escape(설명(r, D), quote=True),
            url=f"{SITE}/f/{qid}/",
            image=html.escape(image, quote=True),
            qid=html.escape(qid, quote=True),
        )
        d = os.path.join(OUT, qid)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, "index.html"), "w", encoding="utf-8") as fp:
            fp.write(page)
        남길것.add(qid)

    # 목록에서 빠진 휴양림의 폴더는 치운다. 안 그러면 죽은 주소가 계속 살아 있다.
    지움 = 0
    if os.path.isdir(OUT):
        for name in os.listdir(OUT):
            p = os.path.join(OUT, name)
            if os.path.isdir(p) and name not in 남길것:
                shutil.rmtree(p)
                지움 += 1

    print(f"공유 페이지 {len(남길것)}개 생성 "
          f"(휴양림 사진 {사진있음} · 대표 이미지 대체 {len(남길것) - 사진있음})"
          + (f" · 묵은 폴더 {지움}개 삭제" if 지움 else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
