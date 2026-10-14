# -*- coding: utf-8 -*-
"""숲나들e 이용요금 표(칸 배열) -> 객실별 성수기·비수기 × 주중·주말 요금

crawl_details.py 가 표를 칸 그대로 펴서 data/details.json 에 넣어 두면, 여기서
어느 칸이 어느 요금인지 읽어 낸다. build_dataset.py 가 가져다 쓴다.

국립은 형식이 하나(비수기 주중 / 성수기 및 주말)지만 공립·사립은 휴양림이 직접
편집기로 쓴 표라서 머리줄이 제각각이다. 그래서 표마다 규칙을 두지 않고,
머리줄 낱말로 칸의 뜻을 읽는다.

  · 머리줄 = 금액이 처음 나오는 줄 앞까지. 여러 줄이면 칸마다 위아래를 이어 읽는다.
  · 요금 칸 = 머리에 성수기·비수기·주중·주말·평일·요금·사용료 같은 말이 있는 칸.
  · 요금 칸이 맡는 경우 = 아래 네 가지 중 어디에 해당하는지.

        비주(비수기 주중)  비말(비수기 주말)  성주(성수기 주중)  성말(성수기 주말)

    "비수기 주중"         -> 비주
    "성수기 및 주말"       -> 성주·성말·비말   (한 칸 안에 '및'으로 묶은 건 합집합)
    "성수기" / "주말" 두 줄 -> 성말            (머리 두 줄로 나뉜 건 교집합)
    "성수기"              -> 성주·성말
    "요금"                -> 넷 다           (철·요일 구분 없는 한 값)

입장료·주차료·개인/단체처럼 숙박이 아닌 표와 줄은 걷어 낸다. 걸러진 뒤 남은 줄이
없으면 그 휴양림은 요금 없음으로 둔다. 틀린 값을 보여 주느니 비워 두는 편이 낫다.
"""

import re

경우들 = ("비주", "비말", "성주", "성말")
전부 = frozenset(경우들)

# 숙박 요금 범위. 이보다 작으면 입장료·주차료, 크면 단체 시설 통대관이다.
최소요금, 최대요금 = 5_000, 1_500_000

금액 = re.compile(r"(?<![\d,])(\d{1,3}(?:,\d{3})+|\d{4,7})(?![\d,])")
요금머리 = re.compile(r"성수기|비수기|주중|주말|평일|휴일|요금|사용료|이용료|금액|대여료")
요금아님 = re.compile(r"인원|규모|면적|비고|기준$|사용시간|시간|주차")
# 숙박이 아닌 요금 — 칸 머리나 줄 이름에 이런 말이 있으면 뺀다.
비숙박 = re.compile(r"어른|성인|청소년|어린이|군인|입장|주차|개인|단체|경로|장애|"
                 r"대형|소형|중형|^일반$|1인|1시간|시간당|세미나|회의|강당|식당|매점|"
                 r"썰매|체험|교육|프로그램|자전거|짚라인|수영|입욕|샤워|전기|"
                 r"이불|침구|바비큐|바베큐|그릴|숯|파라솔|평상|그늘막|타프|텐트대여|"
                 r"모험|전동|모노레일|승합|화물|승용|버스|차량|풋살|족구|운동장|경기장|"
                 r"피크닉|치유실|^요$")
# 머리줄로 볼 수 있는 줄. 이게 하나도 없는 줄이 나오면 거기서부터는 몸통이다.
머리낱말 = re.compile(r"구분|시설|객실|호실|건물|명$|인원|요금|사용료|이용료|금액|성수기|비수기|"
                   r"주중|주말|평일|기준|비고|규모|면적|사용기간|형태|휴양림")
인원머리 = re.compile(r"인원|정원|최대|^기준")


def 다듬기(t):
    """'숙 박 시 설' -> '숙박시설', 'ㆍ4인실' -> '4인실'. 줄바꿈은 띄어쓰기로."""
    t = re.sub(r"\s+", " ", (t or "").replace("\n", " ")).strip().lstrip("ㆍ·-").strip()
    if re.fullmatch(r"(?:\S ){2,}\S", t):
        t = t.replace(" ", "")
    return t


def 숫자(s):
    m = 금액.search(s or "")
    if not m:
        return None
    v = int(m.group(1).replace(",", ""))
    return v if 최소요금 <= v <= 최대요금 else None


def 금액칸(s):
    """칸 전체가 사실상 금액인가. '75,000', '75,000원', '3,000(상품권 환급)' 등."""
    s = (s or "").strip()
    return bool(금액.match(s)) or bool(re.match(r"^\d{1,3}(,\d{3})+\s*원", s))


def 칸뜻(머리들):
    """한 칸의 머리줄 글자들(위에서 아래로) -> 그 칸이 맡는 경우들의 집합."""
    줄들 = [re.sub(r"\s+", "", h) for h in 머리들]
    합 = "".join(줄들)
    성, 비 = "성수기" in 합, "비수기" in 합
    중 = bool(re.search(r"주중|평일", 합))
    말 = bool(re.search(r"주말|휴일", 합))

    철 = 전부
    if 성 and not 비:
        철 = {"성주", "성말"}
    elif 비 and not 성:
        철 = {"비주", "비말"}
    요일 = 전부
    if 중 and not 말:
        요일 = {"비주", "성주"}
    elif 말 and not 중:
        요일 = {"비말", "성말"}

    if 철 is not 전부 and 요일 is not 전부:
        # 한 칸 안에 함께 적혀 있으면 '성수기 및 주말' 식의 묶음.
        # 성수기+주말 / 비수기+주중 조합만 합집합으로 읽는다(반대 조합은 뜻이 안 통한다).
        같은줄 = any(("성수기" in h or "비수기" in h) and re.search(r"주중|평일|주말|휴일", h)
                   for h in 줄들)
        if 같은줄 and 성 and 말:
            return frozenset(철 | 요일)
        return frozenset(철 & 요일)
    return frozenset(철 & 요일)


def 펼치기(rows, 값칸):
    """한 칸에 객실 여러 개를 줄바꿈으로 적은 줄을 객실마다 한 줄로 나눈다.

    금액 칸이 n줄 모두 금액이면 n개로 본다. 다른 칸도 n줄이면 줄마다 나눠 갖고,
    줄 수가 다르면(사용시간 안내 등) 통째로 붙인다.
    """
    for r in rows:
        n = 1
        for c in 값칸:
            줄 = r[c].split("\n")
            if len(줄) > 1 and all(금액칸(x) for x in 줄):
                n = max(n, len(줄))
        if n == 1:
            yield r
            continue
        for i in range(n):
            yield [c.split("\n")[i] if len(c.split("\n")) == n else c for c in r]


def 표해석(grid):
    """칸 배열 하나 -> [{"이름", "인원", "요금": {경우: 원}}]"""
    if not grid:
        return []
    폭 = max(len(r) for r in grid)
    grid = [r + [""] * (폭 - len(r)) for r in grid]

    grid = [[(c or "").strip() for c in r] for r in grid]

    첫값 = next((i for i, r in enumerate(grid) if any(금액칸(c) for c in r)), None)
    if not 첫값:
        return []                       # 머리줄이 없으면 칸 뜻을 알 수 없다
    # 금액 줄 앞이라도 '입장료 | 무료 | 무료' 같은 줄은 몸통이다. 위에서부터
    # 머리 낱말이 있는 줄만 머리로 친다.
    머리수 = 0
    for r in grid[:첫값]:
        if any(c == "무료" for c in r) or not any(머리낱말.search(re.sub(r"\s+", "", c)) for c in r):
            break
        머리수 += 1
    if not 머리수:
        return []
    머리 = [[c.replace("\n", " ") for c in r] for r in grid[:머리수]]
    칸머리 = [[머리[r][c] for r in range(len(머리))] for c in range(폭)]

    요금칸, 인원칸, 인원머리합, 이름칸 = {}, None, "", []
    for c, hs in enumerate(칸머리):
        합 = re.sub(r"\s+", "", "".join(dict.fromkeys(hs)))
        if 요금머리.search(합) and not 요금아님.search(합):
            if 비숙박.search(합):
                continue
            요금칸[c] = 칸뜻(list(dict.fromkeys(hs)))
        elif 인원머리.search(합) and not 요금머리.search(합):
            # '기준(1동/1박)' 보다 '기준 인원' 이 낫다. 인원이란 말이 있는 칸을 먼저 잡는다.
            if 인원칸 is None or ("인원" in 합 and "인원" not in 인원머리합):
                인원칸, 인원머리합 = c, 합
        elif not re.search(r"비고|시간|면적|규모|휴양림$|사용기간|사용기준|이용기준|사용단위|주차", 합):
            이름칸.append(c)
    if not 요금칸:
        return []

    # 좁은 뜻의 칸이 먼저 자리를 잡는다. '결제금액 | 성수기' 처럼 철 구분 없는 칸과
    # 성수기 칸이 함께 있으면, 성수기 몫은 성수기 칸이 갖고 나머지가 비수기가 된다.
    차례 = sorted(요금칸.items(), key=lambda kv: len(kv[1]))

    out = []
    for r in 펼치기(grid[머리수:], [c for c, _ in 차례]):
        요금 = {}
        for c, 뜻 in 차례:
            v = 숫자(r[c])
            if v is None:
                continue
            for k in 뜻:
                요금.setdefault(k, v)
        if not 요금:
            continue
        이름 = []
        for c in 이름칸:
            t = 다듬기(r[c])
            if t and t not in 이름 and not 금액칸(t) and "자연휴양림" not in t.replace(" ", ""):
                이름.append(t)
        이름 = " · ".join(이름)
        if 비숙박.search(re.sub(r"\s+", "", 이름)):
            continue
        인원 = r[인원칸].replace("\n", " ") if 인원칸 is not None else ""
        out.append({"이름": 이름, "인원": 인원, "요금": 요금})
    return out


def 휴양림요금(tables):
    """한 휴양림의 표들 -> 객실 줄 목록(중복 제거). 없으면 []"""
    rows, 본 = [], set()
    for t in tables:
        for row in 표해석(t.get("grid") or []):
            key = (row["이름"], row["인원"], tuple(sorted(row["요금"].items())))
            if key in 본:
                continue
            본.add(key)
            rows.append(row)
    return rows


def 범위(rows):
    vs = [v for r in rows for v in r["요금"].values()]
    return [min(vs), max(vs)] if vs else None
