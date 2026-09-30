/* 전국 자연휴양림 한눈에 — 예약 일정·공식 경쟁률·인기도
   데이터: forests.json — 레코드 배열 + 반복 문자열은 사전(라벨 배열) + 인덱스. */
'use strict';

// 카카오 JavaScript 키. 브라우저에 노출되는 값이라 숨길 수 없고, 등록된 도메인
// (pjungjin85-sketch.github.io)에서만 동작하므로 다른 사이트에 옮겨 써도 소용없다.
// 지도 탭에서 새 키를 넣으면 그 값이 이 기본값을 덮는다.
const KAKAO_KEY = 'a83ccf5d0f76a309473878b4530aa580';

const PAGE = 40;                                   // 목록을 한 번에 그리는 개수
const KOREA = { lat: 36.35, lng: 127.9 };          // 전국이 한 화면에 들어오는 중심
const TYPE_COLOR = ['#1E9575', '#3D7BD1', '#8A6BC4'];   // 국립 / 공립 / 사립
const TYPE_CLASS = ['nat', 'pub', 'pri'];

const SORTS = [
  { k: 'pop',  label: '인기순' },
  { k: 'comp', label: '공식 경쟁률순' },
  { k: 'name', label: '이름순' },
];

const $ = (id) => document.getElementById(id);
const el = {
  q: $('q'), clear: $('clear'), hit: $('hit'), scope: $('scope'),
  headMeta: $('headMeta'), footMeta: $('footMeta'),
  schedCards: $('schedCards'),
  kindChips: $('kindChips'), areaChips: $('areaChips'), typeChips: $('typeChips'),
  resvChips: $('resvChips'), tagChips: $('tagChips'), sortChips: $('sortChips'),
  tabList: $('tabList'), tabMap: $('tabMap'), paneList: $('paneList'), paneMap: $('paneMap'),
  list: $('list'), more: $('more'), empty: $('empty'),
  map: $('map'), mapkey: $('mapkey'), mapreset: $('mapreset'),
  keyInput: $('keyInput'), keySave: $('keySave'), originHint: $('originHint'),
  sheet: $('sheet'), sheetClose: $('sheetClose'), sheetWhere: $('sheetWhere'),
  sheetName: $('sheetName'), sheetBadges: $('sheetBadges'),
  sheetComp: $('sheetComp'), sheetCompSub: $('sheetCompSub'),
  sheetPop: $('sheetPop'), sheetPopSub: $('sheetPopSub'),
  sheetResv: $('sheetResv'), sheetIntro: $('sheetIntro'), sheetSpec: $('sheetSpec'),
  sheetActs: $('sheetActs'), controls: document.querySelector('.controls'),
};

let D = null;          // forests.json 전체
let F = [];            // D.휴양림
let NORM = [];         // 검색용 정규화 문자열 (이름·별칭·지역·주소)
let NAME = [];         // 이름·별칭만. 초성 인덱스의 원본
let CHO = null;        // 초성 인덱스 (처음 필요할 때 만든다)
let results = [];      // 필터 결과 — 인덱스 배열
let shown = 0;
let refitNext = true;  // 지도 뷰포트를 다시 맞출지. 위치 기준이 바뀔 때만 켠다

const filter = { q: '', kind: 0, area: -1, type: -1, resv: -1, tag: -1, sort: 'pop' };

/* ---------------- 예약 일정 ---------------- */

/* 숲나들e 추첨 이용안내(/rep/drlts/drltsUseGdnc.do)에 적힌 국립 공통 규칙을
   오늘 날짜에 대입해 "다음에 뭘 해야 하는지"로 바꾼다. 전부 클라이언트 계산이라
   수집이 필요 없고, 날짜가 지나도 저절로 다음 일정으로 넘어간다. */

const DAY = ['일', '월', '화', '수', '목', '금', '토'];

function at(y, m, d, h, mi) { return new Date(y, m, d, h, mi || 0, 0, 0); }

function fmtDate(dt) {
  return `${dt.getMonth() + 1}월 ${dt.getDate()}일(${DAY[dt.getDay()]})`;
}
function fmtDateTime(dt) {
  const h = dt.getHours();
  return `${fmtDate(dt)} ${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시`;
}
function dday(now, target) {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const n = Math.round((b - a) / 86400000);
  return n === 0 ? 'D-DAY' : n > 0 ? `D-${n}` : `${-n}일 전`;
}

/** 선착순 — 매주 수요일 09:00 에 6주 뒤 이용분이 열린다. */
function firstComeCard(now) {
  const wed = new Date(now);
  wed.setHours(9, 0, 0, 0);
  // 오늘이 수요일이고 아직 9시 전이면 오늘, 아니면 다음 수요일
  const gap = (3 - wed.getDay() + 7) % 7;
  if (gap > 0 || now >= wed) wed.setDate(wed.getDate() + (gap || 7));

  const from = new Date(wed); from.setDate(from.getDate() + 42);
  const to = new Date(from); to.setDate(to.getDate() + 6);
  return {
    name: '선착순 예약',
    when: fmtDateTime(wed) + ' 오픈',
    dday: dday(now, wed),
    now: dday(now, wed) === 'D-DAY',
    what: `이때 열리는 이용일은 ${fmtDate(from)} ~ ${fmtDate(to)} 입니다. `
        + '인기 휴양림은 몇 분 만에 마감되니 미리 로그인해 두세요.',
  };
}

/** 주말추첨 — 매월 4일 09:00 접수 → 9일 18:00 마감 → 10일 16:00 발표 → 15일 09:00 잔여 선착순 */
function weekendLotteryCard(now) {
  const y = now.getFullYear(), m = now.getMonth();
  const open = at(y, m, 4, 9), close = at(y, m, 9, 18);
  const draw = at(y, m, 10, 16), left = at(y, m, 15, 9);

  let when, what, target;
  const 대상월 = (mm) => `${(mm + 1) % 12 + 1}월`;      // 접수하는 달의 다음 달
  if (now < open) {
    target = open;
    when = fmtDateTime(open) + ' 접수 시작';
    what = `${대상월(m)} 금·토·공휴일 전일 이용분이 대상입니다. 9일 오후 6시까지 신청합니다.`;
  } else if (now < close) {
    target = close;
    when = fmtDateTime(close) + ' 접수 마감';
    what = `${대상월(m)} 이용분 접수가 진행 중입니다. 10일 오후 4시에 발표합니다.`;
  } else if (now < draw) {
    target = draw;
    when = fmtDateTime(draw) + ' 당첨 발표';
    what = '숲나들e 마이페이지에서 결과를 확인합니다.';
  } else if (now < left) {
    target = left;
    when = fmtDateTime(left) + ' 잔여분 선착순';
    what = '미당첨·미결제분이 6주 예약정책으로 다시 풀립니다.';
  } else {
    target = at(y, m + 1, 4, 9);
    when = fmtDateTime(target) + ' 접수 시작';
    what = `${대상월(m + 1)} 금·토·공휴일 전일 이용분이 대상입니다.`;
  }
  return {
    name: '주말 추첨', when, what,
    dday: dday(now, target), now: dday(now, target) === 'D-DAY',
  };
}

/** 성수기추첨 — 7/15~8/24 이용분. 접수는 5월 말~6월 사이로 매년 따로 공지된다. */
function peakLotteryCard(now) {
  const y = now.getFullYear();
  const 성수기끝 = at(y, 7, 24, 23, 59);
  const 해 = now > 성수기끝 ? y + 1 : y;
  const 접수 = at(해, 4, 25, 9);                      // 5월 말 — 정확한 날짜는 매년 공지
  const 이용 = at(해, 6, 15, 0);
  // at() 의 달은 0부터라 6 은 7월. 접수 창은 5월 25일 ~ 6월 말로 잡는다.
  const 접수중 = now >= 접수 && now < at(해, 6, 1, 0);
  return {
    name: '여름 성수기 추첨',
    // 접수 일자는 매년 따로 공지되는 값이라 못 박지 않는다. 접수 중일 때는
    // D-day 대신 '접수 중'을 띄우고, 그 밖에는 확정된 이용 기간을 기준으로 센다.
    when: 접수중 ? `${해}년 접수 기간 (숲나들e 공지 확인)`
                 : `${해}년 7월 15일 ~ 8월 24일 이용분`,
    dday: 접수중 ? '접수 중' : dday(now, 이용),
    now: 접수중,
    what: '접수는 5월 말~6월 중에 열리며 정확한 일자는 매년 따로 공지됩니다. '
        + '1인당 최대 3곳까지 신청할 수 있습니다.',
  };
}

function renderSchedule() {
  const now = new Date();
  const cards = [firstComeCard(now), weekendLotteryCard(now), peakLotteryCard(now)];
  el.schedCards.innerHTML = cards.map((c) => `
    <div class="scard">
      <div class="scard__top">
        <span class="scard__name">${esc(c.name)}</span>
        <span class="scard__dday${c.now ? ' is-now' : ''}">${esc(c.dday)}</span>
      </div>
      <p class="scard__when">${esc(c.when)}</p>
      <p class="scard__what">${esc(c.what)}</p>
    </div>`).join('');
}

/* ---------------- 검색 ---------------- */

const CHO_TABLE = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

function norm(s) { return (s || '').toLowerCase().replace(/\s+/g, ''); }
function isChosung(s) { return /^[ㄱ-ㅎ]+$/.test(s); }

/** 초성 인덱스는 초성 검색을 처음 쓸 때만 만든다. 평소엔 만들 이유가 없다.

    주소가 아니라 이름만 대상으로 삼는다. 주소까지 넣으면 띄어쓰기를 지운 자리에서
    단어 경계를 넘는 가짜 매치가 생긴다 — '강원특별자치도 강릉시' 가 '도강릉' 이 되어
    ㄷㄱㄹ 로 검색한 대관령과 함께 걸려 나온다. */
function buildChosung() {
  CHO = NAME.map((s) => {
    let out = '';
    for (const ch of s) {
      const c = ch.charCodeAt(0) - 0xac00;
      out += (c >= 0 && c <= 11171) ? CHO_TABLE[Math.floor(c / 588)] : ch;
    }
    return out;
  });
}

function compOf(i) { return F[i].경쟁률; }
function popOf(i) { return (F[i].블로그 || 0) + (F[i].카페 || 0); }

function search() {
  const q = norm(filter.q);
  const cho = q && isChosung(filter.q.trim());
  if (cho && !CHO) buildChosung();
  const hay = cho ? CHO : NORM;

  results = [];
  for (let i = 0; i < F.length; i++) {
    const f = F[i];
    if (f.구분 !== filter.kind) continue;
    if (filter.area >= 0 && f.권역 !== filter.area) continue;
    if (filter.type >= 0 && f.유형 !== filter.type) continue;
    if (filter.resv >= 0 && f.예약 !== filter.resv) continue;
    if (filter.tag >= 0 && !f.태그.includes(filter.tag)) continue;
    if (q && !hay[i].includes(q)) continue;
    results.push(i);
  }

  const byName = (a, b) => F[a].이름.localeCompare(F[b].이름, 'ko');
  if (filter.sort === 'comp') {
    // 발표가 없는 곳은 뒤로 보낸다. 0 으로 취급하면 "경쟁률 0"처럼 읽힌다.
    results.sort((a, b) => {
      const x = compOf(a), y = compOf(b);
      if (x == null && y == null) return byName(a, b);
      if (x == null) return 1;
      if (y == null) return -1;
      return y - x;
    });
  } else if (filter.sort === 'pop') {
    results.sort((a, b) => popOf(b) - popOf(a) || byName(a, b));
  } else {
    results.sort(byName);
  }

  shown = 0;
  el.list.innerHTML = '';
  renderMore();
  updateTally();
  syncMarkers();
}

function updateTally() {
  el.hit.textContent = results.length.toLocaleString('ko-KR');
  const bits = [];
  bits.push(D.구분라벨[filter.kind]);
  if (filter.area >= 0) bits.push(D.권역라벨[filter.area]);
  if (filter.type >= 0) bits.push(D.유형라벨[filter.type]);
  if (filter.resv >= 0) bits.push(D.예약라벨[filter.resv]);
  if (filter.tag >= 0) bits.push(D.태그라벨[filter.tag]);
  if (filter.q) bits.push(`"${filter.q}"`);
  el.scope.textContent = bits.join(' · ');
}

/* ---------------- 목록 ---------------- */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function highlight(name) {
  const q = filter.q.trim();
  if (!q || isChosung(q)) return esc(name);
  const at = norm(name).indexOf(norm(q));
  if (at < 0) return esc(name);
  // 정규화(공백 제거)한 위치를 원문 위치로 되돌린다
  let seen = 0, from = -1, to = -1;
  for (let i = 0; i < name.length; i++) {
    if (/\s/.test(name[i])) continue;
    if (seen === at) from = i;
    if (seen === at + norm(q).length - 1) { to = i + 1; break; }
    seen++;
  }
  if (from < 0 || to < 0) return esc(name);
  return esc(name.slice(0, from)) + '<mark>' + esc(name.slice(from, to)) + '</mark>' + esc(name.slice(to));
}

/** 별점을 ★ 문자열로. 0.5 단위는 반쪽 별로 표시한다. */
function starMarks(v) {
  const full = Math.floor(v), half = v - full >= 0.5;
  return '★'.repeat(full) + (half ? '⯨' : '') + '☆'.repeat(5 - full - (half ? 1 : 0));
}

let 인기도있음 = false;      // 한 곳도 없으면 목록에서 인기도 줄 자체를 뺀다

function popBlock(f) {
  if (f.별점 == null) {
    return 인기도있음 ? '<span class="stars__none">인기도 수집 전</span>' : '';
  }
  const n = (f.블로그 || 0) + (f.카페 || 0);
  return `<span class="stars"><span class="stars__marks">${starMarks(f.별점)}</span>`
       + `${f.별점.toFixed(1)} <span>· 블로그·카페 ${n.toLocaleString('ko-KR')}건</span></span>`;
}

function compBlock(f) {
  if (f.경쟁률 == null) return '';
  const 해 = D.경쟁률자료.기준연도 || '';
  return `<span class="comp"><span class="comp__medal">🏅</span>공식 경쟁률 ${f.경쟁률} : 1`
       + `<span style="font-weight:500">(${해} 성수기)</span></span>`;
}

function renderMore() {
  const slice = results.slice(shown, shown + PAGE);
  const html = slice.map((i, n) => {
    const f = F[i];
    const t = f.유형 >= 0 ? f.유형 : 0;
    return `<li class="row" data-n="${shown + n}" tabindex="0">
      <div class="row__top">
        <span class="kind kind--${TYPE_CLASS[t]}">${esc(D.유형라벨[t])}</span>
        <span class="row__resv">${esc(D.예약라벨[f.예약])}</span>
        <span class="row__where">${esc(f.권역 >= 0 ? D.권역라벨[f.권역] : '')} ${esc(f.시군구)}</span>
      </div>
      <p class="row__name">${highlight(f.이름)}</p>
      <div class="row__meta">${popBlock(f)}${compBlock(f)}</div>
    </li>`;
  }).join('');
  el.list.insertAdjacentHTML('beforeend', html);
  shown += slice.length;

  const rest = results.length - shown;
  el.more.hidden = rest <= 0;
  el.more.textContent = `더 보기 (${rest.toLocaleString('ko-KR')}곳 남음)`;
  el.empty.hidden = results.length > 0;
}

/* ---------------- 상세 시트 ---------------- */

const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function kakaoPlaceUrl(f) {
  const host = IS_MOBILE ? 'https://m.map.kakao.com' : 'https://map.kakao.com';
  return `${host}/?q=${encodeURIComponent(f.이름)}`;
}

/** 이 휴양림에 적용되는 예약 규칙을 문장으로 풀어 준다. */
function resvDetail(f) {
  const way = D.예약라벨[f.예약];
  if (f.예약 === 0) {
    return `<p class="resv__detail">평일·비수기는 <b>선착순</b> — 이용일 6주 전 <b>수요일 오전 9시</b>에 열립니다.<br>`
         + `다음 달 금·토·공휴일 전일과 여름 성수기(7/15~8/24)는 <b>추첨</b> — 매월 <b>4일 9시~9일 18시</b> 신청, `
         + `<b>10일 16시</b> 발표, 미당첨·미결제분은 <b>15일 9시</b>에 선착순으로 풀립니다.</p>`
         + `<p class="resv__detail" style="color:var(--muted)">추첨 대상 휴양림은 숲나들e 공지 기준으로 확정됩니다. 신청 전 확인하세요.</p>`;
  }
  if (f.예약 === 1) {
    return `<p class="resv__detail">이용일 6주 전 <b>수요일 오전 9시</b>에 선착순으로 열립니다. 추첨 대상이 아닙니다.</p>`;
  }
  if (f.예약 === 2) {
    return `<p class="resv__detail">공립 휴양림은 지자체마다 정책이 다릅니다. 일부는 <b>월 추첨</b>이나 <b>지역주민 추첨</b>을 운영합니다.<br>`
         + `정확한 방식과 오픈 시각은 아래 숲나들e 페이지에서 확인하세요.</p>`;
  }
  return `<p class="resv__detail">사립 휴양림은 휴양림별로 예약 방식이 다릅니다. 아래 페이지에서 확인하세요.</p>`;
}

function openSheet(i) {
  const f = F[i];
  const t = f.유형 >= 0 ? f.유형 : 0;

  el.sheetWhere.textContent = `${f.권역 >= 0 ? D.권역라벨[f.권역] : ''} · ${f.시도} ${f.시군구}`;
  el.sheetName.textContent = f.이름;

  const badges = [`<span class="kind kind--${TYPE_CLASS[t]}">${esc(D.유형라벨[t])}</span>`]
    .concat(f.태그.slice(0, 8).map((n) => `<span class="tag">#${esc(D.태그라벨[n])}</span>`));
  el.sheetBadges.innerHTML = badges.join('');

  // --- 공식 경쟁률 (미슐랭 스타 쪽) ---
  const c = D.경쟁률자료 || {};
  if (f.경쟁률 != null) {
    el.sheetComp.className = 'gauge__value';
    el.sheetComp.textContent = `${f.경쟁률} : 1`;
    el.sheetCompSub.innerHTML = `${esc(c.기준연도)} ${esc(c.구분 || '')}<br>`
      + `전체 평균 ${esc(c.전체 ? c.전체.평균 : '—')} : 1 · `
      + `<a href="${esc(c.출처링크 || '#')}" target="_blank" rel="noopener">발표 자료</a>`;
  } else {
    el.sheetComp.className = 'gauge__value gauge__value--none';
    el.sheetComp.textContent = '공식 발표 없음';
    el.sheetCompSub.innerHTML = c.전체
      ? `산림청 발표는 상위 몇 곳만 공개됩니다.<br>${esc(c.기준연도)}년 전체 평균은 ${esc(c.전체.평균)} : 1 입니다.`
      : '';
  }

  // --- 인기도 (지도 별점 쪽) ---
  if (f.별점 != null) {
    el.sheetPop.className = 'gauge__value';
    el.sheetPop.innerHTML = `<span style="color:var(--star)">${starMarks(f.별점)}</span> ${f.별점.toFixed(1)}`;
    el.sheetPopSub.textContent =
      `네이버 블로그 ${(f.블로그 || 0).toLocaleString('ko-KR')}건 · `
      + `카페 ${(f.카페 || 0).toLocaleString('ko-KR')}건`
      + (D.인기도수집일 ? ` (${D.인기도수집일} 기준)` : '');
  } else {
    el.sheetPop.className = 'gauge__value gauge__value--none';
    el.sheetPop.textContent = '수집 전';
    el.sheetPopSub.textContent = '네이버 검색 API 키가 설정되면 채워집니다.';
  }

  // --- 예약 방식 ---
  el.sheetResv.innerHTML = `<p class="resv__head">예약 방식</p>`
    + `<p class="resv__way">${esc(D.예약라벨[f.예약])}</p>` + resvDetail(f);

  el.sheetIntro.textContent = f.소개 || '';
  el.sheetIntro.hidden = !f.소개;

  const spec = [];
  if (f.주소) spec.push(['주소', f.주소]);
  if (f.전화) spec.push(['전화', f.전화]);
  if (f.입실 && f.퇴실) spec.push(['입·퇴실', `${f.입실} 입실 / ${f.퇴실} 퇴실`]);
  if (f.수용) spec.push(['최대 수용', `${f.수용.toLocaleString('ko-KR')}명`]);
  if (f.개장) spec.push(['개장', `${f.개장}년`]);
  el.sheetSpec.innerHTML = spec
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');

  const acts = [];
  const resvUrl = `https://www.foresttrip.go.kr/indvz/main.do?hmpgId=${encodeURIComponent(f.id)}`;
  acts.push(`<a class="act act--go" href="${esc(f.홈 || resvUrl)}" target="_blank" rel="noopener">숲나들e에서 예약</a>`);
  if (f.y != null) acts.push(`<a class="act" href="${esc(kakaoPlaceUrl(f))}" target="_blank" rel="noopener">길찾기</a>`);
  if (f.전화) acts.push(`<a class="act" href="tel:${esc(f.전화.replace(/[^0-9]/g, ''))}">전화</a>`);
  el.sheetActs.innerHTML = acts.join('');

  el.sheet.hidden = false;
  el.sheet.scrollTop = 0;
}

function closeSheet() { el.sheet.hidden = true; }

/* ---------------- 지도 ---------------- */

let map = null, markers = [], markersDirty = false;
const markerImages = {};

function markerImage(typeIdx, big) {
  const key = typeIdx + (big ? 'B' : '');
  if (markerImages[key]) return markerImages[key];
  const c = TYPE_COLOR[typeIdx] || TYPE_COLOR[0];
  const w = big ? 34 : 26, h = big ? 44 : 34;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 26 34">
    <path d="M13 0C5.8 0 0 5.8 0 13c0 9.5 13 21 13 21s13-11.5 13-21C26 5.8 20.2 0 13 0z" fill="${c}"/>
    <circle cx="13" cy="13" r="5" fill="#fff"/></svg>`;
  const img = new kakao.maps.MarkerImage(
    'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
    new kakao.maps.Size(w, h), { offset: new kakao.maps.Point(w / 2, h) });
  markerImages[key] = img;
  return img;
}

function syncMarkers() {
  if (!map) return;
  // 지도 pane 이 화면에 없으면 다시 그리지 않는다. 목록만 보는 동안 입력이 버벅인다.
  if (el.paneMap.offsetParent === null) { markersDirty = true; return; }
  markersDirty = false;

  markers.forEach((m) => m.setMap(null));
  markers = [];

  const bounds = new kakao.maps.LatLngBounds();
  let any = false;
  for (const i of results) {
    const f = F[i];
    if (f.y == null || f.x == null) continue;
    const pos = new kakao.maps.LatLng(f.y, f.x);
    const m = new kakao.maps.Marker({
      position: pos, map,
      image: markerImage(f.유형 >= 0 ? f.유형 : 0, f.경쟁률 != null),
      title: f.이름, zIndex: f.경쟁률 != null ? 2 : 1,
    });
    kakao.maps.event.addListener(m, 'click', () => openSheet(i));
    markers.push(m);
    bounds.extend(pos);
    any = true;
  }

  if (any && refitNext) map.setBounds(bounds);
  refitNext = false;
  el.mapreset.hidden = !any;
}

function bootMap(key) {
  return new Promise((resolve, reject) => {
    if (window.kakao && window.kakao.maps) return resolve();
    const s = document.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    s.onload = () => kakao.maps.load(resolve);
    s.onerror = () => reject(new Error('SDK 로드 실패'));
    document.head.appendChild(s);
  });
}

function tryBootMap() {
  const fromUrl = new URLSearchParams(location.search).get('key');
  const key = fromUrl || localStorage.getItem('kakaoKey') || KAKAO_KEY;
  el.originHint.textContent = location.origin;
  if (!key) return;

  bootMap(key).then(() => {
    map = new kakao.maps.Map(el.map, {
      center: new kakao.maps.LatLng(KOREA.lat, KOREA.lng), level: 13,
    });
    map.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
    el.mapkey.hidden = true;
    try { localStorage.setItem('kakaoKey', key); } catch (e) { /* 사파리 사생활 보호 모드 */ }
    refitNext = true;
    syncMarkers();
  }).catch(() => {
    try { localStorage.removeItem('kakaoKey'); } catch (e) { /* 무시 */ }
    el.mapkey.hidden = false;
  });
}

/* ---------------- UI 조립 ---------------- */

function chip(label, on) {
  return `<button class="chip${on ? ' is-on' : ''}" type="button">${esc(label)}</button>`;
}

/** 라벨 배열로 칩 묶음을 만든다. all 이 true 면 맨 앞에 '전체'(-1)를 둔다. */
function buildChips(box, labels, key, all) {
  const items = all ? [{ v: -1, t: '전체' }] : [];
  labels.forEach((t, v) => items.push({ v, t }));
  box.innerHTML = items.map((it) => chip(it.t, filter[key] === it.v)).join('');
  box.querySelectorAll('.chip').forEach((b, n) => {
    b.addEventListener('click', () => {
      filter[key] = items[n].v;
      box.querySelectorAll('.chip').forEach((x, k) => x.classList.toggle('is-on', k === n));
      if (key === 'area' || key === 'kind') refitNext = true;
      search();
    });
  });
}

function buildSortChips() {
  el.sortChips.innerHTML = SORTS.map((s) => chip(s.label, filter.sort === s.k)).join('');
  el.sortChips.querySelectorAll('.chip').forEach((b, n) => {
    b.addEventListener('click', () => {
      filter.sort = SORTS[n].k;
      el.sortChips.querySelectorAll('.chip').forEach((x, k) => x.classList.toggle('is-on', k === n));
      search();
    });
  });
}

/** 필터 칩에 쓸 태그. 숲나들e 원본 태그는 '등산'·'등산로'처럼 비슷한 게 여럿이라
    칩으로 세우면 고르기 어렵다. 앞쪽에 깔아 둔 특징 태그만 쓰고, 원본 태그는
    상세 화면 배지로만 보여 준다. 해당하는 곳이 너무 적은 특징도 뺀다. */
function topTags(limit) {
  const 특징수 = D.특징태그수 || D.태그라벨.length;
  const count = D.태그라벨.map(() => 0);
  F.forEach((f) => f.태그.forEach((n) => { count[n]++; }));
  return D.태그라벨
    .map((t, n) => ({ t, n, c: count[n] }))
    .filter((x) => x.n < 특징수 && x.c >= 5)
    .sort((a, b) => b.c - a.c)
    .slice(0, limit);
}

function buildTagChips() {
  const tags = topTags(14);
  const items = [{ v: -1, t: '특징 전체' }].concat(tags.map((x) => ({ v: x.n, t: x.t })));
  el.tagChips.innerHTML = items.map((it) => chip(it.t, filter.tag === it.v)).join('');
  el.tagChips.querySelectorAll('.chip').forEach((b, n) => {
    b.addEventListener('click', () => {
      filter.tag = items[n].v;
      el.tagChips.querySelectorAll('.chip').forEach((x, k) => x.classList.toggle('is-on', k === n));
      search();
    });
  });
}

function setPane(which) {
  const isMap = which === 'map';
  el.tabList.classList.toggle('is-on', !isMap);
  el.tabMap.classList.toggle('is-on', isMap);
  el.tabList.setAttribute('aria-selected', String(!isMap));
  el.tabMap.setAttribute('aria-selected', String(isMap));
  el.paneList.classList.toggle('is-on', !isMap);
  el.paneMap.classList.toggle('is-on', isMap);
  if (isMap && map) {
    map.relayout();
    if (markersDirty) { refitNext = true; syncMarkers(); }
  }
}

function measureControls() {
  document.documentElement.style.setProperty(
    '--controls-h', el.controls.offsetHeight + 'px');
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ---------------- init ---------------- */

function init() {
  renderSchedule();

  el.q.addEventListener('input', debounce(() => {
    filter.q = el.q.value.trim();
    el.clear.hidden = !filter.q;
    refitNext = true;
    search();
  }, 120));
  el.clear.addEventListener('click', () => {
    el.q.value = ''; filter.q = ''; el.clear.hidden = true; refitNext = true; search(); el.q.focus();
  });

  el.more.addEventListener('click', renderMore);

  el.list.addEventListener('click', (e) => {
    const row = e.target.closest('.row');
    if (row) openSheet(results[+row.dataset.n]);
  });
  el.list.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('.row');
    if (row) { e.preventDefault(); openSheet(results[+row.dataset.n]); }
  });

  el.sheetClose.addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

  el.tabList.addEventListener('click', () => setPane('list'));
  el.tabMap.addEventListener('click', () => setPane('map'));
  el.mapreset.addEventListener('click', () => { refitNext = true; syncMarkers(); });
  el.keySave.addEventListener('click', () => {
    const k = el.keyInput.value.trim();
    if (!k) return;
    try { localStorage.setItem('kakaoKey', k); } catch (e) { /* 무시 */ }
    location.reload();
  });

  window.addEventListener('resize', debounce(measureControls, 150));

  fetch('forests.json')
    .then((r) => r.json())
    .then((data) => {
      D = data;
      F = D.휴양림;
      NORM = F.map((f) => norm(`${f.이름} ${f.별칭} ${f.시도} ${f.시군구} ${f.주소}`));
      NAME = F.map((f) => norm(`${f.이름} ${f.별칭}`));

      const 휴양림수 = F.filter((f) => f.구분 === 0).length;
      el.headMeta.textContent =
        `전국 ${휴양림수}곳 · 자료 ${D.수집일시 ? D.수집일시.slice(0, 10) : D.updated} 기준`;
      el.footMeta.textContent =
        `자료 갱신 ${D.updated}` + (D.인기도수집일 ? ` · 인기도 ${D.인기도수집일}` : '');

      // 인기도가 아직 수집되지 않았으면 인기순으로 정렬해도 전부 0 이라 이름순이나
      // 다름없다. 그럴 때는 공식 경쟁률순을 기본값으로 둬서 배지가 붙은 곳을 위로 올린다.
      인기도있음 = F.some((f) => f.별점 != null);
      if (!인기도있음) filter.sort = 'comp';

      buildChips(el.kindChips, D.구분라벨, 'kind', false);
      buildChips(el.areaChips, D.권역라벨, 'area', true);
      buildChips(el.typeChips, D.유형라벨, 'type', true);
      buildChips(el.resvChips, D.예약라벨, 'resv', true);
      buildTagChips();
      buildSortChips();

      search();
      measureControls();
      tryBootMap();
    })
    .catch(() => {
      el.scope.textContent = '자료를 불러오지 못했습니다. 새로고침해 주세요.';
    });
}

init();
