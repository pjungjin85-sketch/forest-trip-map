# -*- coding: utf-8 -*-
"""숲나들e 휴양림별 소개 사진과 이용요금 표 -> data/details.json

휴양림마다 숲나들e 안에 작은 홈페이지가 있고, 거기 두 화면을 읽는다.

  GET /pot/rm/ri/selectRcrfrIntrdDtlView.do   자연휴양림안내 — 사진 슬라이드
  GET /pot/rm/ug/selectFcltUseGdncView.do     이용요금(ruleId=205) — 요금 표

둘 다 로그인 없이 열리는 일반 화면이고 robots.txt 에서 허용된 경로다.

요금 표는 국립이면 형식이 하나(객실구분·객실명·최대인원·비수기 주중·성수기 및 주말)지만,
공립·사립은 휴양림이 편집기로 직접 쓴 표라 칸 구성이 제각각이다. 그래서 여기서는
표를 **칸 그대로** 2차원 배열로 펴서(rowspan·colspan 풀어서) 저장만 하고, 어느 칸이
성수기·주말인지 읽어 내는 일은 build_dataset.py 가 맡는다. 해석 규칙을 고칠 때
다시 긁을 필요가 없게 하려는 것이다.

실패해도 기존 details.json 을 그대로 두고 조용히 끝낸다. 사진·요금은 있으면 좋은
값이지, 없다고 배포를 막을 값은 아니다. 한 곳이 실패하면 그곳만 이전 값을 쓴다.
"""

import html
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request
from html.parser import HTMLParser
from http.cookiejar import CookieJar

BASE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(BASE, "data", "raw_forests.json")
OUT = os.path.join(BASE, "data", "details.json")

SITE = "https://www.foresttrip.go.kr"
INTRO = SITE + "/pot/rm/ri/selectRcrfrIntrdDtlView.do?hmpgId={id}&menuId=002001"
FEE = SITE + "/pot/rm/ug/selectFcltUseGdncView.do?hmpgId={id}&menuId=004002005&ruleId=205"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

DELAY = 0.4
RETRIES = 4
BR = "\x00"          # 칸 안의 줄바꿈 표시. 소스 HTML 의 줄바꿈과 구분하려고 따로 둔다
MAX_PHOTOS = 12      # 상세 화면 가로 스크롤에 이 이상은 넘겨 보지 않는다


def request(op, url):
    for attempt in range(RETRIES):
        req = urllib.request.Request(url)
        req.add_header("User-Agent", UA)
        req.add_header("Referer", SITE + "/")
        try:
            with op.open(req, timeout=25) as res:
                return res.read().decode("utf-8", "replace")
        except (urllib.error.URLError, OSError):
            if attempt == RETRIES - 1:
                raise
            time.sleep(1.5 * (2 ** attempt) + random.random())
    raise RuntimeError("unreachable")


def text(s):
    s = re.sub(r"(?i)<br\s*/?>", " ", s)
    s = html.unescape(re.sub(r"<[^>]+>", " ", s)).replace("\xa0", " ")
    return re.sub(r"\s+", " ", s).strip()


def photos(page):
    """소개 화면 슬라이드의 사진. 같은 사진이 썸네일·원본으로 두 번 나오므로 순서를 지켜 중복을 걷는다."""
    out = []
    for m in re.finditer(r'<img[^>]*class="autosize"[^>]*>', page):
        tag = m.group(0)
        src = re.search(r'src="([^"]+)"', tag)
        if not src:
            continue
        url = html.unescape(src.group(1)).strip()
        if "image.foresttrip.go.kr" not in url or url in (p["src"] for p in out):
            continue
        desc = re.search(r'data-description="([^"]*)"', tag)
        out.append({"src": url, "설명": text(html.unescape(desc.group(1))) if desc else ""})
    return out[:MAX_PHOTOS]


class Tables(HTMLParser):
    """<table> 을 칸 배열로 편다. rowspan·colspan 은 같은 글자로 채워 넣는다."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables, self.stack = [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "table":
            self.stack.append({"rows": [], "row": None, "cell": None,
                               "caption": "", "in_caption": False})
        elif not self.stack:
            return
        t = self.stack[-1] if self.stack else None
        if tag == "caption":
            t["in_caption"] = True
        elif tag == "tr":
            t["row"] = []
        elif tag in ("td", "th") and t["row"] is not None:
            span = lambda k: max(1, min(50, int(re.sub(r"\D", "", a.get(k) or "1") or 1)))
            t["cell"] = {"t": [], "rs": span("rowspan"), "cs": span("colspan"), "th": tag == "th"}
        elif tag in ("br", "p", "div", "li") and t["cell"] is not None:
            # 한 칸에 객실 여러 개를 <p> 로 줄줄이 쓴 표가 있다(영인산·소백산 등).
            # 그냥 이으면 '40,00050,000' 이 되므로 줄을 남겨 두고, 해석은 fees.py 가 한다.
            t["cell"]["t"].append(BR)

    def handle_endtag(self, tag):
        if not self.stack:
            return
        t = self.stack[-1]
        if tag == "caption":
            t["in_caption"] = False
        elif tag in ("td", "th") and t["cell"] is not None and t["row"] is not None:
            c = t["cell"]
            줄들 = (re.sub(r"\s+", " ", x).strip() for x in "".join(c["t"]).split(BR))
            c["t"] = "\n".join(x for x in 줄들 if x)
            t["row"].append(c)
            t["cell"] = None
        elif tag == "tr" and t["row"] is not None:
            t["rows"].append(t["row"])
            t["row"] = None
        elif tag == "table":
            self.stack.pop()
            grid = expand(t["rows"])
            if grid:
                self.tables.append({"caption": t["caption"].strip(), "grid": grid})

    def handle_data(self, data):
        if not self.stack:
            return
        t = self.stack[-1]
        if t["in_caption"]:
            t["caption"] += data
        elif t["cell"] is not None:
            t["cell"]["t"].append(data.replace(BR, ""))


def expand(rows):
    grid, pending = [], {}   # pending[(r, c)] = 글자 (위에서 내려온 rowspan)
    for r, row in enumerate(rows):
        out, c = [], 0
        cells = list(row)
        while cells or (r, c) in pending:
            if (r, c) in pending:
                out.append(pending.pop((r, c)))
                c += 1
                continue
            cell = cells.pop(0)
            for dc in range(cell["cs"]):
                out.append(cell["t"])
                for dr in range(1, cell["rs"]):
                    pending[(r + dr, c + dc)] = cell["t"]
            c += cell["cs"]
        if any(out):
            grid.append(out)
    return grid


def fee_tables(page):
    p = Tables()
    p.feed(page)
    # 요금표만 남긴다. 금액(3자리 쉼표 숫자)이 하나도 없는 표는 달력·안내 표다.
    return [t for t in p.tables
            if any(re.search(r"\d{1,3},\d{3}", c) for row in t["grid"] for c in row)]


def main():
    try:
        with open(RAW, encoding="utf-8") as fp:
            facilities = json.load(fp)["시설"]
    except (OSError, ValueError):
        print(f"{RAW} 를 읽지 못해 사진·요금 수집을 건너뜁니다.")
        return 0
    try:
        with open(OUT, encoding="utf-8") as fp:
            prev = json.load(fp).get("시설", {})
    except (OSError, ValueError):
        prev = {}

    targets = [f for f in facilities if "자연휴양림" in f["별칭"]]
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
    t0, out, failed = time.time(), {}, []

    for i, f in enumerate(targets, 1):
        iid = f["insttId"]
        try:
            ph = photos(request(op, INTRO.format(id=iid)))
            time.sleep(DELAY)
            fees = fee_tables(request(op, FEE.format(id=iid)))
            time.sleep(DELAY)
            out[iid] = {"사진": ph, "요금표": fees}
        except Exception as e:
            failed.append(f["이름"])
            if iid in prev:
                out[iid] = prev[iid]
            print(f"  {f['이름']} 실패, 이전 값 사용: {e}")
        if i % 25 == 0:
            print(f"  {i:3d}/{len(targets)} · {time.time() - t0:.0f}초", flush=True)

    if len(out) < len(targets) * 0.5:
        print(f"절반도 못 받아({len(out)}/{len(targets)}) 기존 자료를 그대로 둡니다.")
        return 0

    payload = {"수집일": time.strftime("%Y-%m-%d"), "시설": out}
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fp:
        json.dump(payload, fp, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)

    사진 = sum(1 for v in out.values() if v["사진"])
    요금 = sum(1 for v in out.values() if v["요금표"])
    print(f"\n완료: {len(out)}/{len(targets)}곳 · 사진 있음 {사진} · 요금표 있음 {요금} · "
          f"{time.time() - t0:.0f}초")
    if failed:
        print(f"실패 {len(failed)}곳: {', '.join(failed[:10])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
