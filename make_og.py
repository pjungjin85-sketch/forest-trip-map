# -*- coding: utf-8 -*-
"""공유 미리보기 이미지 생성 -> og.png (1200x630)

카카오톡·슬랙·페이스북에 링크를 붙였을 때 뜨는 그림이다.
사이트 마스트헤드를 그대로 옮겨서, 링크만 보고도 같은 곳임을 알아보게 한다.

휴양림 사진 한 장을 쓰면 그 휴양림 전용 페이지처럼 보여서 쓰지 않는다.
172곳을 모아 놓은 곳이라는 게 미리보기에서도 드러나야 한다.

문구나 색을 바꿨을 때만 다시 돌리면 된다. 자동 갱신에서는 돌리지 않는다.
    python3 make_og.py
"""

import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(BASE, "og.png")

W, H = 1200, 630
FOREST, DEEP, INK, MUTED = (34, 170, 134), (30, 149, 117), (46, 52, 64), (124, 131, 143)

# 맥에 기본으로 깔린 글꼴. 6번이 Bold, 4번이 SemiBold.
FONT_PATH = "/System/Library/Fonts/AppleSDGothicNeo.ttc"

EYEBROW = "숲나들e 예약정보 모아보기"
TITLE_1, TITLE_2 = "전국 자연휴양림", "한눈에"
LINES = ["전국 172곳의 예약 방식과 다음 오픈 일정",
         "산림청 공식 경쟁률과 인기도를 함께"]


def font(size, index=6):
    return ImageFont.truetype(FONT_PATH, size, index=index)


def 침엽수(cx, base, h, w, 단=4):
    tris = []
    for i in range(단):
        t = i / (단 - 1)
        top = base - h * (0.30 + 0.70 * t)
        bot = top + h * 0.30
        half = w * (1 - t * 0.72) / 2
        tris.append([(cx - half, bot), (cx, top), (cx + half, bot)])
    return tris, (cx - w * 0.055, base - h * 0.22, cx + w * 0.055, base)


def 활엽수(cx, base, h, w):
    r = w / 2
    cy = base - h + r * 0.85
    circles = [(cx + dx, cy + dy, rr) for dx, dy, rr in
               ((0, 0, r), (-r * .62, r * .34, r * .66), (r * .62, r * .30, r * .62),
                (-r * .30, -r * .40, r * .58), (r * .34, -r * .36, r * .55))]
    return circles, (cx - w * 0.045, cy, cx + w * 0.045, base)


def 능선(base, 진폭, 파장, 위상):
    pts = [(x, base - 진폭 * (math.sin(x / 파장 + 위상) * .5
                             + math.sin(x / (파장 * .43) + 위상 * 1.7) * .5))
           for x in range(0, W + 20, 20)]
    return [(0, H)] + pts + [(W, H)]


def 나무줄(ld, color, base, 높이, 간격, 단):
    x = -20
    while x < W + 30:
        h = random.uniform(*높이)
        w = h * random.uniform(.44, .58)
        if random.random() < .74:
            tris, trunk = 침엽수(x, base, h, w, 단=단)
            for t in tris:
                ld.polygon(t, fill=color)
        else:
            circles, trunk = 활엽수(x, base, h * .84, w * 1.28)
            for cx, cy, rr in circles:
                ld.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=color)
        ld.rectangle(trunk, fill=color)
        x += random.uniform(*간격)


def main():
    if not os.path.exists(FONT_PATH):
        raise SystemExit(f"[중단] 글꼴을 찾지 못했습니다: {FONT_PATH}")

    random.seed(7)          # 사이트 마스트헤드와 같은 시드 — 같은 숲이 나온다
    img = Image.new("RGB", (W, H), "white")

    def 층(alpha, 그리기):
        nonlocal img
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        그리기(ImageDraw.Draw(lay), FOREST + (alpha,))
        img = Image.alpha_composite(img.convert("RGBA"), lay).convert("RGB")

    # 뒤에서 앞으로. 뒤일수록 작고 연하게 그려야 안개 낀 산처럼 보인다.
    층(16, lambda ld, c: ld.polygon(능선(H * .62, 34, 420, 0.4), fill=c))
    층(22, lambda ld, c: ld.polygon(능선(H * .74, 26, 280, 2.1), fill=c))
    층(36, lambda ld, c: 나무줄(ld, c, H * .88, (62, 100), (28, 42), 4))
    층(54, lambda ld, c: 나무줄(ld, c, H + 8, (125, 190), (58, 92), 5))

    # 글자가 놓이는 왼쪽을 흰색으로 덮는다. 사이트 SVG 의 그라디언트 마스크와 같은 역할.
    fade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fade)
    for x in range(760):
        a = 255 if x < 430 else int(255 * (1 - (x - 430) / 330))
        fd.line([(x, 0), (x, H)], fill=(255, 255, 255, a))
    img = Image.alpha_composite(img.convert("RGBA"), fade).convert("RGB")

    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 10], fill=FOREST)

    X, Y = 78, 118
    d.text((X, Y), EYEBROW, font=font(26), fill=DEEP)

    d.text((X, Y + 58), TITLE_1, font=font(92), fill=INK)
    d.text((X, Y + 168), TITLE_2, font=font(92), fill=FOREST)

    d.line([(X, Y + 310), (X + 92, Y + 310)], fill=FOREST, width=5)
    for i, line in enumerate(LINES):
        d.text((X, Y + 338 + i * 40), line, font=font(30, 4), fill=MUTED)

    img.save(OUT, optimize=True)
    print(f"완료: {OUT} ({W}x{H}, {os.path.getsize(OUT) / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
