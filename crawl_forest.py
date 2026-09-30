# -*- coding: utf-8 -*-
"""숲나들e(foresttrip.go.kr) -> data/raw_forests.json

전국 산림휴양시설 목록과 각 시설의 좌표·주소·전화·소개글을 모은다.

숲나들e 는 화면마다 세션 쿠키와 _csrf 토큰을 요구한다. 토큰은 메인 페이지 HTML
안에 ajax URL 의 쿼리스트링으로 박혀 있어서, 메인을 한 번 받아 쿠키와 토큰을
같이 확보한 뒤 그 둘을 모든 요청에 실어 보낸다.

쓰는 엔드포인트 세 개 (2026-09 기준 robots.txt 에서 전부 Allow):
  GET  /rep/cm/remmnAreaOrRcfclList.do  전체 목록 (시도·시군구·국공사립)
  POST /com/sub/selectMapInfo.do        시설 상세 (위경도·주소·전화·수용인원)
  POST /com/selectInsttInfoList.do      태그 검색 (태그·관심수·대표이미지)

태그는 자유 입력 검색이라 전체 목록을 주는 API 가 없다. 씨앗 태그로 시작해
응답에 들어 있는 dtlCont(해당 시설의 태그 목록)에서 새 태그를 주워 다시 검색하는
식으로 넓혀 간다. 그래도 태그가 하나도 없는 시설이 남으므로 태그와 관심수는
보조 필드로만 쓰고, 없다고 해서 수집을 실패로 보지 않는다.
"""

import html
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
OUT = os.path.join(BASE, "data", "raw_forests.json")

SITE = "https://www.foresttrip.go.kr"
MAIN = SITE + "/main.do?hmpgId=FRIP"

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

DELAY = 0.4          # 요청 간 간격(초). 공공 사이트라 넉넉히 둔다
RETRIES = 6          # 지수 백오프 재시도 횟수
SAVE_EVERY = 20      # 이만큼 받을 때마다 중간 저장
MISSING_LIMIT = 10   # 좌표 없는 시설이 이보다 많으면 배포를 막는다

# 태그 탐색의 씨앗. 응답에서 새 태그를 주워 계속 넓히므로 완전할 필요는 없다.
SEED_TAGS = [
    "계곡", "바다", "숲", "가족", "단풍", "힐링", "물놀이", "산책로", "전망",
    "캠핑", "야영", "반려견", "온천", "눈꽃", "봄꽃", "편백", "잣나무", "소나무",
    "아이", "연인", "등산", "트레킹", "체험", "놀이터", "수영장", "글램핑",
    "일출", "야경", "역사", "호수",
]


def opener_with_cookies():
    """쿠키를 유지하는 opener. 숲나들e 는 세션 쿠키가 없으면 ajax 를 거부한다."""
    return urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(CookieJar()))


def request(op, url, data=None, ajax=True, retries=RETRIES):
    """GET/POST 한 번. 실패하면 지수 백오프 + 지터로 다시 시도한다.

    지터를 섞는 이유는 재시도가 같은 순간에 겹쳐 서버를 두 번 때리지 않게 하려는 것.
    """
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    for attempt in range(retries):
        req = urllib.request.Request(url, data=body)
        req.add_header("User-Agent", UA)
        req.add_header("Referer", MAIN)
        if ajax:
            req.add_header("X-Requested-With", "XMLHttpRequest")
            req.add_header("X-Ajax-call", "true")
        if body is not None:
            req.add_header("Content-Type",
                           "application/x-www-form-urlencoded; charset=UTF-8")
        try:
            with op.open(req, timeout=30) as res:
                return res.read().decode("utf-8", "replace")
        except (urllib.error.URLError, OSError) as e:
            if attempt == retries - 1:
                raise
            time.sleep(1.5 * (2 ** attempt) + random.random())
    raise RuntimeError("unreachable")


def strip_html(s):
    """소개글에서 태그를 걷어내고 평문으로 만든다.

    insttDscrt 는 위지윅 편집기가 뱉은 값이라 빈 <p>&nbsp;</p> 가 수십 개씩
    들어 있는 경우가 있다. 태그를 지운 뒤 공백을 접어야 읽을 만해진다.
    """
    if not s:
        return ""
    s = re.sub(r"(?is)<(script|style).*?</\1>", " ", s)
    s = re.sub(r"(?i)<br\s*/?>|</p>|</div>", "\n", s)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = s.replace("\xa0", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n\s*\n+", "\n", s)
    return s.strip()


def save(payload):
    """.tmp 에 쓰고 os.replace 로 갈아끼운다. 중간에 죽어도 기존 파일이 안 깨진다."""
    tmp = OUT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, OUT)


def fetch_session(op):
    """메인 페이지에서 세션 쿠키와 _csrf 토큰을 확보한다."""
    home = request(op, MAIN, ajax=False)
    m = re.search(r"_csrf=([0-9a-f-]{36})", home)
    if not m:
        raise SystemExit("[중단] 메인 페이지에서 _csrf 토큰을 찾지 못했습니다. "
                         "사이트 구조가 바뀌었을 수 있습니다.")
    return m.group(1)


def fetch_list(op, csrf):
    """전체 시설 목록. lvl 3 이 개별 시설, lvl 1 은 시도 묶음이다."""
    url = f"{SITE}/rep/cm/remmnAreaOrRcfclList.do?_csrf={csrf}"
    rows = json.loads(request(op, url))

    sido = {r["arcd"]: r["codeNm"].strip() for r in rows if r["lvl"] == 1}
    out = []
    for r in rows:
        if r["lvl"] != 3:
            continue
        # codeNm: " 강원, 강원특별자치도, 강릉시, 대관령 자연휴양림"
        parts = [p.strip() for p in r["codeNm"].split(",")]
        out.append({
            "insttId": r["insttId"],
            "별칭": r["codeDc"].strip(),            # "(강릉시)대관령자연휴양림"
            "유형": r["insttTpCdNm"],               # 국립 / 공립 / 사립
            "권역": sido.get(r["arcd"], ""),        # "강원"
            "시도": parts[1] if len(parts) > 1 else "",
            "시군구": parts[2] if len(parts) > 2 else "",
            "법정코드": r["detailCode"],
        })
    return out


def fetch_detail(op, csrf, instt_id):
    """시설 상세. 좌표·주소·전화·입퇴실시각·수용인원이 여기 들어 있다."""
    url = f"{SITE}/com/sub/selectMapInfo.do?_csrf={csrf}"
    d = (json.loads(request(op, url, {"insttId": instt_id})) or {}).get("result")
    if not d:
        return None
    return {
        "이름": (d.get("insttNm") or "").strip(),
        "위도": d.get("insttLttd"),
        "경도": d.get("insttLngtd"),
        "주소": (d.get("roadNmAddr") or "").strip(),
        "우편번호": (d.get("ltnoZipcd") or "").strip(),
        "전화": (d.get("insttTlno") or "").strip(),
        "입실": d.get("ethrmTm"),          # "150000" -> 15:00
        "퇴실": d.get("lthrmTm"),
        "최대수용": d.get("mxmmAccptNofpr"),
        "개장년도": (d.get("insttMkyr") or "").strip(),
        "소개": strip_html(d.get("insttDscrt")),
        "운영": d.get("useYn"),
    }


def fetch_tags(op, csrf):
    """태그 검색을 넓혀 가며 시설별 태그·관심수·대표이미지를 모은다.

    selectInsttInfoList.do 는 srchTag 하나만 받고 태그 목록 API 는 따로 없다.
    다만 응답의 dtlCont 에 그 시설이 달고 있는 태그가 전부 들어 있어서,
    거기서 새 태그를 주워 큐에 넣으면 사이트가 실제로 쓰는 태그 집합에 수렴한다.
    """
    url = f"{SITE}/com/selectInsttInfoList.do?_csrf={csrf}"
    seen_tag, queue, found = set(), list(SEED_TAGS), {}

    while queue:
        tag = queue.pop(0)
        if tag in seen_tag:
            continue
        seen_tag.add(tag)
        try:
            items = json.loads(request(op, url, {"srchTag": tag})).get("result") or []
        except Exception as e:                      # 태그 하나 실패가 전체를 막지 않게
            print(f"  태그 '{tag}' 실패: {e}", flush=True)
            continue
        time.sleep(DELAY)

        for it in items:
            tags = [t.strip() for t in (it.get("dtlCont") or "").split(",") if t.strip()]
            rec = found.setdefault(it["insttId"], {
                "태그": [], "관심수": it.get("intrsCnt") or 0,
                "이미지": it.get("rltvImageStoreCrse") or "",
                "홈페이지": it.get("url") or "",
            })
            for t in tags:
                if t not in rec["태그"]:
                    rec["태그"].append(t)
                if t not in seen_tag:
                    queue.append(t)

    print(f"  태그 {len(seen_tag)}종 탐색 · 시설 {len(found)}곳에 태그가 붙었습니다",
          flush=True)
    return found


def main():
    t0 = time.time()
    op = opener_with_cookies()

    csrf = fetch_session(op)
    print(f"세션 확보 (_csrf={csrf[:8]}…)", flush=True)

    facilities = fetch_list(op, csrf)
    print(f"목록 {len(facilities)}곳", flush=True)

    print("상세 수집", flush=True)
    failed = []
    for i, f in enumerate(facilities, 1):
        try:
            detail = fetch_detail(op, csrf, f["insttId"])
        except Exception as e:
            failed.append((f["insttId"], str(e)))
            detail = None
        if detail:
            f.update(detail)
        else:
            failed.append((f["insttId"], "빈 응답"))
        time.sleep(DELAY)
        if i % SAVE_EVERY == 0:
            save({"수집일시": time.strftime("%Y-%m-%d %H:%M:%S"), "시설": facilities})
            print(f"  {i:3d}/{len(facilities)}", flush=True)

    if failed:
        print(f"상세 실패 {len(failed)}곳, 재시도", flush=True)
        for instt_id, _ in list(failed):
            f = next(x for x in facilities if x["insttId"] == instt_id)
            try:
                detail = fetch_detail(op, csrf, instt_id)
                if detail:
                    f.update(detail)
                    failed = [x for x in failed if x[0] != instt_id]
            except Exception:
                pass
            time.sleep(DELAY * 2)

    print("태그 수집", flush=True)
    tags = fetch_tags(op, csrf)
    for f in facilities:
        f.update(tags.get(f["insttId"], {}))

    # 좌표가 없으면 지도에서 조용히 사라진다. 몇 곳인지 반드시 눈에 띄게 남긴다.
    missing = [f for f in facilities if not f.get("위도") or not f.get("경도")]
    save({"수집일시": time.strftime("%Y-%m-%d %H:%M:%S"), "시설": facilities})

    print(f"\n완료: {len(facilities)}곳 · {time.time() - t0:.0f}초 · {OUT}")
    if missing:
        print(f"좌표 없음 {len(missing)}곳:")
        for f in missing[:20]:
            print(f"  {f['별칭']} ({f['insttId']})")
    if len(missing) > MISSING_LIMIT:
        raise SystemExit(
            f"[중단] 좌표 없는 시설이 {len(missing)}곳입니다. 이대로 배포하면 "
            f"지도에서 조용히 빠지므로 여기서 멈춥니다.")
    if failed:
        raise SystemExit(
            f"[중단] 상세를 끝내 못 받은 시설이 {len(failed)}곳 있습니다: "
            f"{', '.join(x[0] for x in failed[:10])}")


if __name__ == "__main__":
    sys.exit(main())
