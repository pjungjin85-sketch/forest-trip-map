/* 전국 자연휴양림 한눈에 — 예약 일정·공식 경쟁률·인기도
   데이터: forests.json — 레코드 배열 + 반복 문자열은 사전(라벨 배열) + 인덱스. */
'use strict';

// 카카오 JavaScript 키. 브라우저에 노출되는 값이라 숨길 수 없고, 등록된 도메인
// (pjungjin85-sketch.github.io)에서만 동작하므로 다른 사이트에 옮겨 써도 소용없다.
// 지도 탭에서 새 키를 넣으면 그 값이 이 기본값을 덮는다.
const KAKAO_KEY = 'dfc27d0d14376cea3f79476be7d2b23e';

const PAGE = 40;                                   // 목록을 한 번에 그리는 개수
const KOREA = { lat: 36.35, lng: 127.9 };          // 전국이 한 화면에 들어오는 중심
const TYPE_COLOR = ['#1E9575', '#3D7BD1', '#8A6BC4'];   // 국립 / 공립 / 사립
const TYPE_CLASS = ['nat', 'pub', 'pri'];


const $ = (id) => document.getElementById(id);
const el = {
  q: $('q'), clear: $('clear'), hit: $('hit'), scope: $('scope'),
  headMeta: $('headMeta'), footMeta: $('footMeta'),
  masthArt: $('masthArt'),
  schedCards: $('schedCards'), schedSum: $('schedSum'),
  schedToggle: $('schedToggle'), schedBody: $('schedBody'),
  areaSel: $('areaSel'), citySel: $('citySel'),
  tagSel: $('tagSel'),
  tabList: $('tabList'), tabMap: $('tabMap'), paneList: $('paneList'), paneMap: $('paneMap'),
  list: $('list'), more: $('more'), empty: $('empty'),
  map: $('map'), mapkey: $('mapkey'), mapreset: $('mapreset'),
  keyInput: $('keyInput'), keySave: $('keySave'), originHint: $('originHint'),
  sheet: $('sheet'), sheetClose: $('sheetClose'), sheetWhere: $('sheetWhere'),
  sheetWrap: $('sheetWrap'), sheetShade: $('sheetShade'),
  sheetGallery: $('sheetGallery'), sheetPhotos: $('sheetPhotos'), photoCount: $('photoCount'),
  photoPrev: $('photoPrev'), photoNext: $('photoNext'), sheetFee: $('sheetFee'),
  spopWrap: $('spopWrap'), spopShade: $('spopShade'), spop: $('spop'), spopInner: $('spopInner'),
  spopTitle: $('spopTitle'), spopDday: $('spopDday'), spopWhen: $('spopWhen'),
  spopBody: $('spopBody'), spopClose: $('spopClose'),
  sheetName: $('sheetName'), sheetBadges: $('sheetBadges'),
  sheetComp: $('sheetComp'), sheetCompSub: $('sheetCompSub'),
  sheetPop: $('sheetPop'), sheetPopSub: $('sheetPopSub'),
  sheetResv: $('sheetResv'), sheetIntro: $('sheetIntro'), sheetSpec: $('sheetSpec'),
  sheetActs: $('sheetActs'), controls: document.querySelector('.controls'),
  sheetShare: $('sheetShare'), shareLabel: $('shareLabel'),
  auth: $('auth'), favChip: $('favChip'), favN: $('favN'), sheetFav: $('sheetFav'),
};

let D = null;          // forests.json 전체
let F = [];            // D.휴양림
let NORM = [];         // 검색용 정규화 문자열 (이름·별칭·지역·주소)
let NAME = [];         // 이름·별칭만. 초성 인덱스의 원본
let CHO = null;        // 초성 인덱스 (처음 필요할 때 만든다)
let results = [];      // 필터 결과 — 인덱스 배열
let shown = 0;
let refitNext = true;  // 지도 뷰포트를 다시 맞출지. 위치 기준이 바뀔 때만 켠다

// 자연휴양림만 다룬다. 숲나들e 목록에 함께 들어 있는 비휴양림 시설 27곳
// (국립등산학교·동서트레일·산림레포츠파크 등)은 화면에 올리지 않는다.
const 자연휴양림 = 0;
const filter = { q: '', area: -1, city: '', tag: -1, sort: 'pop', fav: false };

/* ---------------- 마스트헤드 배경 사진 ---------------- */

/* Pexels 에서 받은 숲 사진 다섯 장(hero/CREDITS.md 참고).
   첫 장만 바로 받고 나머지는 차례가 오기 전에 하나씩 받는다. 다섯 장을 한꺼번에
   받으면 390KB 가 첫 화면 로딩을 붙잡는데, 배경 장식이 그럴 값어치는 없다. */
const HERO = ['green-light', 'pine-path', 'sunrise', 'pine-mist', 'fog'];
const HERO_MS = 5000;

function startHero() {
  if (!el.masthArt || !HERO.length) return;

  const made = [];
  const 만들기 = (n) => {
    if (made[n]) return made[n];
    const img = new Image();
    img.src = `hero/hero-${HERO[n]}.jpg`;
    img.alt = '';
    img.decoding = 'async';
    el.masthArt.appendChild(img);
    made[n] = img;
    return img;
  };

  let 현재 = 0;
  const 첫장 = 만들기(0);
  // 다 받기 전에 켜면 빈 칸이 깜빡인다
  if (첫장.complete) 첫장.classList.add('is-on');
  else 첫장.addEventListener('load', () => 첫장.classList.add('is-on'), { once: true });

  if (HERO.length < 2) return;
  // 애니메이션을 꺼 둔 사람에게는 한 장만 보여 준다
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  만들기(1);                                   // 다음 장을 미리 받아 둔다
  setInterval(() => {
    // 탭이 안 보이면 넘기지 않는다. 돌아왔을 때 몇 장이 건너뛰어 있는 건 의미가 없다
    if (document.hidden) return;
    const 다음 = (현재 + 1) % HERO.length;
    const img = 만들기(다음);
    if (!img.complete) return;                 // 아직 못 받았으면 이번 차례는 거른다
    made[현재].classList.remove('is-on');
    img.classList.add('is-on');
    현재 = 다음;
    만들기((다음 + 1) % HERO.length);          // 그다음 장을 미리
  }, HERO_MS);
}

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
/** 오늘부터 target 날짜까지 남은 날 수. 시각은 무시하고 날짜로만 센다. */
function daysTo(now, target) {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}

function dday(now, target) {
  const n = daysTo(now, target);
  return n === 0 ? 'D-DAY' : n > 0 ? `D-${n}` : `${-n}일 전`;
}

/* 숲나들e '6주 예약정책' — 수요일 9시가 되면 그날부터 6주 안의 날짜를 예약할 수 있다.
   그래서 수요일 W 에 새로 열리는 건 W+35(5주 뒤 수요일) ~ W+41(그다음 화요일) 일주일이다.
   2026-09-14 주말추첨 당첨발표 공지의 표가 근거: 9/16(수) 09:00 -> 10/21 ~ 10/27 이용분. */
const 오픈뒤 = 35;

function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

/** now 이후 첫 수요일 09:00. 오늘이 수요일이고 아직 9시 전이면 오늘. */
function nextWed(now) {
  const wed = new Date(now);
  wed.setHours(9, 0, 0, 0);
  const gap = (3 - wed.getDay() + 7) % 7;
  if (gap > 0 || now >= wed) wed.setDate(wed.getDate() + (gap || 7));
  return wed;
}

/** 수요일 오픈 한 번에 열리는 이용일 [처음, 끝] */
function openRange(wed) { return [addDays(wed, 오픈뒤), addDays(wed, 오픈뒤 + 6)]; }

/** 선착순 — 매주 수요일 09:00 에 6주 안쪽으로 일주일씩 새로 열린다. */
function firstComeCard(now) {
  const wed = nextWed(now);
  const [from, to] = openRange(wed);
  const 범위 = `${fmtDate(from)} ~ ${fmtDate(to)}`;
  return {
    key: 'fc',
    name: '선착순 예약',
    when: fmtDateTime(wed) + ' 오픈',
    dday: dday(now, wed),
    days: daysTo(now, wed),
    now: dday(now, wed) === 'D-DAY',
    범위,                                    // 이때 열리는 이용일
    what: `이때 열리는 이용일은 ${범위} 입니다. `
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
    key: 'wk', name: '주말 추첨', when, what,
    dday: dday(now, target), days: daysTo(now, target), now: dday(now, target) === 'D-DAY',
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
    key: 'pk',
    name: '여름 성수기 추첨',
    // 접수 일자는 매년 따로 공지되는 값이라 못 박지 않는다. 접수 중일 때는
    // D-day 대신 '접수 중'을 띄우고, 그 밖에는 확정된 이용 기간을 기준으로 센다.
    when: 접수중 ? `${해}년 접수 기간 (숲나들e 공지 확인)`
                 : `${해}년 7월 15일 ~ 8월 24일 이용분`,
    dday: 접수중 ? '접수 중' : dday(now, 이용),
    days: 접수중 ? 0 : daysTo(now, 이용),
    now: 접수중,
    what: '접수는 5월 말~6월 중에 열리며 정확한 일자는 매년 따로 공지됩니다. '
        + '1인당 최대 3곳까지 신청할 수 있습니다.',
  };
}

/** 접힌 줄에 들어갈 요약. 이름을 줄여 셋이 한 줄에 들어가게 한다. */
const SCHED_SHORT = { '선착순 예약': '선착순', '주말 추첨': '주말추첨', '여름 성수기 추첨': '성수기' };

function setSchedOpen(open) {
  el.schedToggle.setAttribute('aria-expanded', String(open));
  el.schedBody.hidden = !open;
  try { localStorage.setItem('schedOpen', open ? '1' : '0'); } catch (e) { /* 사생활 보호 모드 */ }
}

function renderSchedule() {
  const now = new Date();
  // 가장 가까운 일정이 앞에 온다. 접힌 요약 줄도 같은 순서를 따른다.
  const cards = [firstComeCard(now), weekendLotteryCard(now), peakLotteryCard(now)]
    .sort((a, b) => a.days - b.days);

  el.schedCards.innerHTML = cards.map((c) => `
    <button class="scard" type="button" data-key="${c.key}" aria-haspopup="dialog">
      <span class="scard__top">
        <span class="scard__name">${esc(c.name)}</span>
        <span class="scard__dday${c.now ? ' is-now' : ''}">${esc(c.dday)}</span>
      </span>
      <span class="scard__when">${esc(c.when)}</span>
      <span class="scard__what">${esc(c.what)}</span>
      <span class="scard__more">자세히 보기<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></span>
    </button>`).join('');

  el.schedSum.innerHTML = cards
    .map((c) => `${esc(SCHED_SHORT[c.name] || c.name)} <b>${esc(c.dday)}</b>`)
    .join(' · ');

  // 넓은 화면은 카드 셋이 가로로 들어가 자리를 거의 안 먹으니 펼쳐 둔다.
  // 휴대폰은 접어 두어야 목록이 첫 화면에 들어온다. 사용자가 바꾸면 그 선택을 기억한다.
  let open = window.matchMedia('(min-width:900px)').matches;
  try {
    const saved = localStorage.getItem('schedOpen');
    if (saved !== null) open = saved === '1';
  } catch (e) { /* 무시 */ }
  setSchedOpen(open);
}

/* ---------------- 예약 일정 상세 팝업 ---------------- */

const FT = 'https://www.foresttrip.go.kr';
const LINK = {
  월별현황: `${FT}/rep/or/sssn/monthRsrvtStatus.do?hmpgId=FRIP&menuId=001004`,
  추첨안내: `${FT}/rep/drlts/drltsUseGdnc.do?hmpgId=FRIP&menuId=001003004`,
  공지: `${FT}/pot/cc/nm/selectNticBbrssListView.do?hmpgId=FRIP&menuId=004001`,
  예약정책: `${FT}/pot/cc/bb/selectFripRsrvtPolcyView.do?hmpgId=FRIP&menuId=002001`,
};

function fmtShort(d) { return `${d.getMonth() + 1}/${d.getDate()}`; }

/** 일정 단계 목록. 지난 단계·지금 단계·다가올 단계를 색으로 나눈다. */
function stepsHtml(now, steps) {
  const cur = steps.findIndex((s) => s.at && now < s.at);
  return `<ol class="tl">${steps.map((s, n) => {
    const st = s.at == null ? '' : n < cur || cur < 0 ? ' is-done' : n === cur ? ' is-next' : '';
    const dd = s.at && n === cur ? `<span class="tl__dday">${esc(dday(now, s.at))}</span>` : '';
    return `<li class="tl__step${st}" style="--i:${n}">
      <p class="tl__when">${esc(s.when)}${dd}</p>
      <p class="tl__what">${s.what}</p>
    </li>`;
  }).join('')}</ol>`;
}

/** 이 일정에 몰리는 인기 휴양림. 공식 경쟁률이 있으면 그걸 먼저, 다음은 관심 등록 수. */
function hotForests(pred, n) {
  return F.map((f, i) => i)
    .filter((i) => F[i].구분 === 자연휴양림 && pred(F[i]))
    .sort((a, b) => ((F[b].경쟁률 || 0) - (F[a].경쟁률 || 0)) || ((F[b].관심 || 0) - (F[a].관심 || 0)))
    .slice(0, n);
}

function hotHtml(title, idxs) {
  if (!idxs.length) return '';
  return `<h3 class="spop__h">${esc(title)}</h3>
    <ul class="hot">${idxs.map((i) => {
      const f = F[i];
      const 값 = f.경쟁률 != null ? `🏅 ${f.경쟁률} : 1`
        : f.관심 != null ? `관심 ${f.관심.toLocaleString('ko-KR')}명` : '';
      return `<li><button class="hot__item" type="button" data-i="${i}">
        <span class="hot__name">${esc(f.이름)}</span>
        <span class="hot__where">${esc(f.시군구)}</span>
        <span class="hot__val">${esc(값)}</span></button></li>`;
    }).join('')}</ul>`;
}

function linksHtml(items) {
  return `<div class="spop__links">${items.map(([label, href, main]) =>
    `<a class="act${main ? ' act--go' : ''}" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`).join('')}</div>`;
}

const 빈객실안내 = `<p class="spop__note">어느 휴양림에 몇 실이 남았는지는 숲나들e가 로그인한 사람에게만
  보여 줍니다. 아래 <b>월별현황조회</b>에서 로그인한 뒤 확인하세요.</p>`;

function fcDetail(now) {
  let wed = nextWed(now);
  const rows = [];
  for (let k = 0; k < 4; k++, wed = addDays(wed, 7)) {
    const [a, b] = openRange(wed);
    rows.push(`<tr><th scope="row">${esc(fmtDateTime(wed))}</th>
      <td>${fmtShort(a)} ~ ${fmtShort(b)}</td><td>${esc(dday(now, wed))}</td></tr>`);
  }
  return `<p class="spop__lead">매주 <b>수요일 오전 9시</b>, 그날부터 <b>6주 안쪽</b> 날짜를 예약할 수 있게
      일주일(수~화)씩 새로 열립니다. 숲나들e는 이를 ‘6주 예약정책’이라 부릅니다.</p>
    <h3 class="spop__h">앞으로 열리는 날</h3>
    <table class="otab"><thead><tr><th scope="col">오픈</th><th scope="col">이용일</th><th scope="col"></th></tr></thead>
      <tbody>${rows.join('')}</tbody></table>
    <p class="spop__note">오픈 직후에는 접속이 몰려 대기열이 뜹니다. 9시 전에 로그인해 두세요.
      주말·성수기 날짜는 추첨으로 먼저 나가고, 남은 것만 이 일정에 풀립니다.</p>
    ${hotHtml('빨리 마감되는 곳', hotForests((f) => f.예약 === 0 || f.예약 === 1, 5))}
    ${빈객실안내}
    ${linksHtml([['월별현황조회 (빈 객실)', LINK.월별현황, true], ['휴양림별 예약정책', LINK.예약정책]])}`;
}

/** 주말추첨 한 회차. m 달에 접수하고, 다음 달 금·토·공휴일 전일 이용분을 뽑는다. */
function weekendCycle(now) {
  let y = now.getFullYear(), m = now.getMonth();
  if (now >= at(y, m, 15, 9)) { m += 1; if (m > 11) { m = 0; y += 1; } }
  return { y, m };
}

/** 15일 잔여분 오픈과 그 뒤 수요일마다 풀리는 이용일. 공지의 표와 같은 계산이다. */
function leftoverRows(y, m) {
  const 첫날 = at(y, m + 1, 1, 0), 말일 = at(y, m + 2, 0, 0);
  const d15 = at(y, m, 15, 9);
  const 직전수 = addDays(d15, -((d15.getDay() - 3 + 7) % 7));      // 15일 이전(같은 날 포함) 마지막 수요일
  const rows = [[d15, 첫날, addDays(직전수, 오픈뒤 + 6)]];
  for (let w = addDays(직전수, 7); addDays(w, 오픈뒤) <= 말일; w = addDays(w, 7)) {
    const [a, b] = openRange(w);
    rows.push([w, a, b]);
  }
  return rows.map(([o, a, b]) => [o, a, b > 말일 ? 말일 : b]);
}

function wkDetail(now) {
  const { y, m } = weekendCycle(now);
  const 대상 = `${(m + 1) % 12 + 1}월`;
  const steps = [
    { at: at(y, m, 4, 9), what: `<b>접수 시작</b> — ${대상} 금·토·공휴일 전일 이용분` },
    { at: at(y, m, 9, 18), what: '<b>접수 마감</b>' },
    { at: at(y, m, 10, 16), what: '<b>당첨 발표</b> — 마이페이지 추첨신청내역·카카오 알림톡' },
    { at: at(y, m, 14, 18), what: '<b>결제 마감</b> — 기한 안에 안 내면 당첨이 자동 취소됩니다', 까지: true },
    { at: at(y, m, 15, 9), what: '<b>잔여분 선착순</b> — 미당첨·미신청·미결제분이 다시 풀립니다' },
  ].map((x) => ({ ...x, when: fmtDateTime(x.at) + (x.까지 ? '까지' : '') }));
  const rows = leftoverRows(y, m).map(([o, a, b]) => `<tr><th scope="row">${esc(fmtDateTime(o))}</th>
      <td>${fmtShort(a)} ~ ${fmtShort(b)}</td><td>${esc(dday(now, o))}</td></tr>`).join('');
  return `<p class="spop__lead">국립자연휴양림의 다음 달 <b>금·토요일과 공휴일 전날</b>은 선착순이 아니라
      <b>추첨</b>으로 먼저 나갑니다. 아세안휴양림은 대상이 아닙니다.</p>
    <h3 class="spop__h">${대상} 이용분 일정</h3>
    ${stepsHtml(now, steps)}
    <h3 class="spop__h">잔여분이 풀리는 날</h3>
    <table class="otab"><thead><tr><th scope="col">오픈</th><th scope="col">${대상} 이용일</th><th scope="col"></th></tr></thead>
      <tbody>${rows}</tbody></table>
    <p class="spop__note">15일에 6주 안쪽 날짜가 한꺼번에 풀리고, 그 뒤 날짜는 수요일마다 일주일씩 열립니다.
      매달 당첨발표 공지에 같은 표가 실립니다.</p>
    ${hotHtml('경쟁이 센 곳', hotForests((f) => f.예약 === 0, 5))}
    ${빈객실안내}
    ${linksHtml([['월별현황조회 (빈 객실)', LINK.월별현황, true], ['추첨 이용안내', LINK.추첨안내], ['공지사항', LINK.공지]])}`;
}

function pkDetail(now) {
  const c = D.경쟁률자료 || {};
  const 해 = now > at(now.getFullYear(), 7, 24, 23, 59) ? now.getFullYear() + 1 : now.getFullYear();
  const steps = [
    { at: null, when: `${해}년 5월 말 ~ 6월 중`, what: '<b>접수</b> — 정확한 일자는 숲나들e 공지로 따로 나옵니다. 1인 최대 3곳' },
    { at: null, when: '접수 마감 뒤', what: '<b>추첨·발표</b> — 공지와 알림톡으로 안내' },
    { at: at(해, 6, 15, 0), when: `${해}년 7월 15일 ~ 8월 24일`, what: '<b>이용 기간</b>' },
  ];
  const 통계 = c.전체 ? `<div class="stat">
      <div><b>${esc(c.전체.평균)} : 1</b><span>전체 평균</span></div>
      <div><b>${esc(c.전체.객실)} : 1</b><span>객실</span></div>
      <div><b>${esc(c.전체.야영)} : 1</b><span>야영</span></div>
    </div>
    ${c.최고객실 ? `<p class="spop__note">가장 치열했던 객실은 ${esc(c.최고객실.휴양림)} ${esc(c.최고객실.객실)}
      (${esc(c.최고객실.경쟁률)} : 1)입니다. 야영장은 객실보다 경쟁이 훨씬 덜합니다.</p>` : ''}` : '';
  return `<p class="spop__lead">여름 성수기(7/15~8/24)는 국립자연휴양림 전 객실이 <b>추첨</b>으로 나갑니다.
      1년 중 가장 경쟁이 셉니다.</p>
    <h3 class="spop__h">${해}년 일정</h3>
    ${stepsHtml(now, steps)}
    ${통계 ? `<h3 class="spop__h">${esc(c.기준연도)}년 결과</h3>${통계}` : ''}
    ${hotHtml(`${c.기준연도 || ''} 경쟁률 상위`, hotForests((f) => f.경쟁률 != null, 5))}
    ${linksHtml([['추첨 이용안내', LINK.추첨안내, true], ['공지사항', LINK.공지],
                 ...(c.출처링크 ? [['경쟁률 발표 기사', c.출처링크]] : [])])}`;
}

const SCHED_DETAIL = { fc: fcDetail, wk: wkDetail, pk: pkDetail };
let spopCard = null;          // 팝업이 빠져나온 카드. 닫을 때 그 자리로 돌아간다

const REDUCE_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ---------------- 카드에서 빠져나오는 팝업 (일정 상세·휴양림 상세 공용) ----------------
   팝업을 제 크기로 그려 두고, 누른 카드 위치로 옮긴 뒤 카드 크기만큼만 잘라 보인다(clip-path).
   scale 로 줄이면 글자가 찌그러지지만, 잘라 보이면 팝업 윗부분이 카드 자리에 처음부터
   또렷이 보여서 카드가 그대로 펼쳐지는 것처럼 보인다. */

const 들림 = 110;           // 카드가 살짝 들리는 시간
const 펼침 = 560;           // 들림을 포함해 다 펼쳐질 때까지
const POP_SHAPE = { transform: 'translate(0px, 0px)', clipPath: 'inset(0px 0px 0px 0px round 20px)' };

function popShape(box, origin, radius) {
  const a = origin.getBoundingClientRect(), b = box.getBoundingClientRect();
  const r = Math.max(0, b.width - a.width), d = Math.max(0, b.height - a.height);
  return {
    transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)`,
    clipPath: `inset(0px ${r}px ${d}px 0px round ${radius}px)`,
  };
}

/** 화면 안에 보이는 요소인가. 목록이 접혔거나 스크롤로 밀려났으면 거기서 나온 척할 수 없다. */
function onScreen(x) {
  if (!x || !x.isConnected) return false;
  const r = x.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
}

/** 열기. origin 이 없으면(지도 마커·공유 링크) 가운데서 살짝 커지며 나타난다. */
function popIn({ box, shade, body }, origin) {
  if (REDUCE_MOTION.matches) { if (origin) origin.classList.add('is-lifted'); return; }
  if (onScreen(origin)) {
    // 1) 카드가 살짝 들렸다가  2) 카드 모양 그대로 떨어져 나와 가운데로 커지며 살짝 튕긴다.
    origin.animate(
      [{ transform: 'none', boxShadow: '0 0 0 rgba(0,0,0,0)' },
       { transform: 'translateY(-4px) scale(1.03)', boxShadow: '0 14px 30px rgba(30,149,117,.28)' }],
      { duration: 들림, easing: 'ease-out' }).onfinish = () => origin.classList.add('is-lifted');
    const from = popShape(box, origin, 14);
    box.animate(
      [{ ...from, offset: 0 },
       // 들림이 끝날 때까지는 카드 자리에 머물고, 그다음 구간에만 살짝 튕기는 곡선을 건다.
       { ...from, offset: 들림 / 펼침, easing: 'cubic-bezier(.2,.85,.25,1.06)' },
       POP_SHAPE],
      { duration: 펼침, easing: 'linear' });
    if (body) {
      // 본문은 상자가 펼쳐지는 동안 아래에서 따라 올라온다.
      body.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
        { duration: 300, delay: 260, easing: 'ease-out', fill: 'backwards' });
    }
  } else {
    box.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }],
      { duration: 300, easing: 'cubic-bezier(.2,.85,.25,1.06)' });
  }
  shade.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: 60, easing: 'ease-out', fill: 'backwards' });
}

/** 닫기. 나온 카드가 화면에 있으면 그 자리로 접혀 들어가고, 없으면 살짝 작아지며 사라진다. */
function popOut({ box, shade, body }, origin, done) {
  const finish = () => {
    [box, shade, body].forEach((x) => x && x.getAnimations().forEach((a) => a.cancel()));
    if (origin) origin.classList.remove('is-lifted');
    done();
  };
  if (REDUCE_MOTION.matches) { finish(); return null; }
  shade.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: 'forwards' });
  let a;
  if (onScreen(origin)) {
    if (body) body.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' });
    a = box.animate([POP_SHAPE, popShape(box, origin, 14)],
      { duration: 320, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
  } else {
    a = box.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }],
      { duration: 200, easing: 'ease-in', fill: 'forwards' });
  }
  a.onfinish = finish;
  return finish;          // 닫히는 도중에 다시 열면 바로 끝내도록 돌려준다
}

const SPOP = () => ({ box: el.spop, shade: el.spopShade, body: el.spopBody });

function openSchedPop(card) {
  if (!D) return;
  const now = new Date();
  const c = [firstComeCard(now), weekendLotteryCard(now), peakLotteryCard(now)]
    .find((x) => x.key === card.dataset.key);
  el.spopTitle.textContent = c.name;
  el.spopDday.textContent = c.dday;
  el.spopDday.classList.toggle('is-now', !!c.now);
  el.spopWhen.textContent = c.when;
  el.spopBody.innerHTML = SCHED_DETAIL[c.key](now);
  el.spopBody.scrollTop = 0;

  spopCard = card;
  el.spopWrap.hidden = false;
  document.body.classList.add('is-modal');
  popIn(SPOP(), card);
  el.spopClose.focus({ preventScroll: true });
}

/** instant 면 움직임 없이 바로 닫는다(팝업 안에서 휴양림 상세로 넘어갈 때). */
function closeSchedPop(instant) {
  if (el.spopWrap.hidden) return;
  const card = spopCard;
  spopCard = null;
  const done = () => {
    el.spopWrap.hidden = true;
    document.body.classList.remove('is-modal');
    if (card && !instant) card.focus({ preventScroll: true });
  };
  if (instant) { if (card) card.classList.remove('is-lifted'); done(); return; }
  popOut(SPOP(), card, done);
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
function popOf(i) { return F[i].관심 || 0; }

function search() {
  const q = norm(filter.q);
  const cho = q && isChosung(filter.q.trim());
  if (cho && !CHO) buildChosung();
  const hay = cho ? CHO : NORM;

  results = [];
  for (let i = 0; i < F.length; i++) {
    const f = F[i];
    if (f.구분 !== 자연휴양림) continue;
    if (filter.area >= 0 && f.권역 !== filter.area) continue;
    if (filter.city && `${f.권역}|${f.시군구}` !== filter.city) continue;
    if (filter.tag >= 0 && !f.태그.includes(filter.tag)) continue;
    if (filter.fav && !favs.has(f.id)) continue;
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
  } else {
    // 정렬은 고르는 게 아니라 늘 인기순이다. 인기도가 아직 없을 때만 경쟁률순으로 대신한다.
    results.sort((a, b) => popOf(b) - popOf(a) || byName(a, b));
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
  if (filter.fav) bits.push('♥ 즐겨찾기');
  if (filter.area >= 0) bits.push(D.권역라벨[filter.area]);
  if (filter.city) bits.push(filter.city.split('|')[1]);
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
    return 인기도있음 ? '<span class="stars__none">인기도 없음</span>' : '';
  }
  return `<span class="stars"><span class="stars__marks">${starMarks(f.별점)}</span>`
       + `${f.별점.toFixed(1)} <span>· 관심 ${(f.관심 || 0).toLocaleString('ko-KR')}명</span></span>`;
}

function compBlock(f) {
  if (f.경쟁률 == null) return '';
  const 해 = D.경쟁률자료.기준연도 || '';
  return `<span class="comp"><span class="comp__medal">🏅</span>공식 경쟁률 ${f.경쟁률} : 1`
       + `<span style="font-weight:500">(${해} 성수기)</span></span>`;
}

/** 대표 사진. 172곳 중 170곳에 있고, 없으면 숲 실루엣을 대신 깐다.
    CDN 이 ?rs= 로 가로폭을 줄여 주므로 썸네일 크기만 받아 쓴다. */
function thumb(f) {
  if (!f.사진 || !D.이미지CDN) return '<div class="row__thumb row__thumb--none" aria-hidden="true"></div>';
  const src = `${D.이미지CDN}${f.사진}?rs=320`;
  return `<img class="row__thumb" src="${esc(src)}" alt="" loading="lazy" decoding="async"
            onerror="this.classList.add('row__thumb--none');this.removeAttribute('src')">`;
}

/* ---------------- 이용 요금 ---------------- */

/** 75000 -> '7.5만'. 만 원 아래(야영데크 등)는 그대로 쓴다. */
function man(v) {
  if (v < 10000) return v.toLocaleString('ko-KR');
  return `${(Math.round(v / 1000) / 10).toLocaleString('ko-KR')}만`;
}

/** 목록·상세 머리에 거는 최소~최대. 객실·야영데크를 통틀어 1박(1일) 요금이다. */
function priceRange(f) {
  const [lo, hi] = f.요금;
  return lo === hi ? `${man(lo)}원` : `${man(lo)}~${man(hi)}원`;
}

function priceBlock(f) {
  if (!f.요금) return '';
  return `<p class="price">${priceRange(f)}</p>`;
}

/* sheet.json — 객실별 요금표와 사진 여러 장. 상세를 처음 열 때 한 번만 받는다. */
let sheetData = null;
function loadSheetData() {
  if (!sheetData) {
    sheetData = fetch('sheet.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .catch(() => { sheetData = null; return {}; });   // 다음에 열 때 다시 받아 본다
  }
  return sheetData;
}

// [이름, 인원, 비수기주중, 비수기주말, 성수기주중, 성수기주말] 에서 요금 칸의 자리
const FEE_KEYS = ['비주', '비말', '성주', '성말'];
const FEE_LABEL = {
  비주: '비수기 주중', 비말: '비수기 주말', 성주: '성수기 주중', 성말: '성수기 주말',
  '비말성주성말': '성수기·주말', '성주성말': '성수기', '비주비말': '비수기',
  '비주성주': '주중', '비말성말': '주말', '비주비말성주성말': '요금',
};
const FEE_FOLD = 8;    // 객실이 이보다 많으면 접어 둔다

/** 모든 객실에서 값이 같은 칸끼리 묶는다. 국립은 '비수기 주중'과
    '성수기 및 주말' 두 값뿐이라 네 칸으로 펼치면 같은 숫자가 세 번 반복된다. */
function feeColumns(rooms) {
  const groups = [];
  FEE_KEYS.forEach((k, j) => {
    const at = j + 2;
    if (rooms.every((r) => r[at] == null)) return;
    const same = groups.find((g) => rooms.every((r) => r[g.at[0]] === r[at]));
    if (same) { same.keys.push(k); same.at.push(at); } else groups.push({ keys: [k], at: [at] });
  });
  return groups.map((g) => ({
    at: g.at[0],
    label: FEE_LABEL[g.keys.join('')] || g.keys.map((k) => FEE_LABEL[k]).join(' / '),
  }));
}

function feeHtml(f, rooms) {
  const cols = feeColumns(rooms);
  const head = `<tr><th scope="col">객실</th>${cols.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('')}</tr>`;
  const body = rooms.map((r, n) => `<tr${n >= FEE_FOLD ? ' class="fee__more" hidden' : ''}>
      <th scope="row">${esc(r[0] || '—')}${r[1] ? `<span>${esc(r[1])}</span>` : ''}</th>
      ${cols.map((c) => `<td>${r[c.at] == null ? '—' : r[c.at].toLocaleString('ko-KR')}</td>`).join('')}
    </tr>`).join('');
  const feeUrl = 'https://www.foresttrip.go.kr/pot/rm/ug/selectFcltUseGdncView.do'
    + `?hmpgId=${encodeURIComponent(f.id)}&menuId=004002005&ruleId=205`;
  return `<p class="fee__head">이용 요금<b>${priceRange(f)}</b></p>
    <div class="fee__scroll"><table class="fee__table">
      <thead>${head}</thead><tbody>${body}</tbody>
    </table></div>
    ${rooms.length > FEE_FOLD
      ? `<button class="fee__toggle" type="button">객실 ${rooms.length}개 모두 보기</button>` : ''}
    <p class="fee__note">1박(1일) 기준, 단위 원. 숲나들e 요금 안내 표를 옮긴 것이라
      실제 결제 금액은 <a href="${esc(feeUrl)}" target="_blank" rel="noopener">원본 요금표</a>에서
      확인하세요. 성수기 기간은 휴양림마다 다릅니다.</p>`;
}

function renderFee(f, info) {
  const rooms = (info && info.객실) || [];
  if (!f.요금 || !rooms.length) {
    el.sheetFee.hidden = true;
    el.sheetFee.innerHTML = '';
    return;
  }
  el.sheetFee.innerHTML = feeHtml(f, rooms);
  el.sheetFee.hidden = false;
}

/* ---------------- 상세 사진 슬라이드 ---------------- */

function renderPhotos(srcs) {
  el.sheetGallery.hidden = !srcs.length;
  el.sheetPhotos.innerHTML = srcs.map((src, n) =>
    `<img class="gallery__img" src="${esc(src)}" alt="" ${n ? 'loading="lazy"' : ''} decoding="async"
       onerror="this.remove()">`).join('');
  el.sheetPhotos.scrollLeft = 0;
  updatePhotoCount();
}

function photoIndex() {
  const w = el.sheetPhotos.clientWidth || 1;
  return Math.round(el.sheetPhotos.scrollLeft / w);
}

function updatePhotoCount() {
  const n = el.sheetPhotos.children.length;
  const i = photoIndex();
  el.photoCount.hidden = n < 2;
  el.photoCount.textContent = `${i + 1} / ${n}`;
  el.photoPrev.hidden = n < 2 || i <= 0;
  el.photoNext.hidden = n < 2 || i >= n - 1;
}

function stepPhoto(d) {
  const w = el.sheetPhotos.clientWidth;
  el.sheetPhotos.scrollTo({ left: (photoIndex() + d) * w, behavior: 'smooth' });
}

function renderMore() {
  const slice = results.slice(shown, shown + PAGE);
  const html = slice.map((i, n) => {
    const f = F[i];
    const t = f.유형 >= 0 ? f.유형 : 0;
    return `<li class="row" data-n="${shown + n}" tabindex="0">
      ${thumb(f)}
      <div class="row__info">
        <div class="row__top">
          <span class="kind kind--${TYPE_CLASS[t]}">${esc(D.유형라벨[t])}</span>
          <span class="row__resv">${esc(D.예약라벨[f.예약])}</span>
          <span class="row__where">${esc(f.권역 >= 0 ? D.권역라벨[f.권역] : '')} ${esc(f.시군구)}</span>
          ${heartButton(f)}
        </div>
        ${priceBlock(f)}
        <p class="row__name">${highlight(f.이름)}</p>
        <div class="row__meta">${popBlock(f)}${compBlock(f)}</div>
      </div>
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
/** 이 휴양림에 지금 적용되는 다음 예약 일시. 상단 패널의 계산을 그대로 쓴다. */
function resvNext(f) {
  if (f.예약 !== 0 && f.예약 !== 1) return '';      // 공립·사립은 규칙이 제각각이라 계산할 수 없다
  const now = new Date();
  const 줄 = [];

  const 선 = firstComeCard(now);
  줄.push({ 꼬리표: '다음 선착순 오픈', when: 선.when.replace(' 오픈', ''),
           dday: 선.dday, now: 선.now, sub: `이때 열리는 이용일 ${선.범위}` });

  if (f.예약 === 0) {
    const 추 = weekendLotteryCard(now);
    줄.push({ 꼬리표: '주말 추첨', when: 추.when, dday: 추.dday, now: 추.now, sub: 추.what });
  }

  return `<div class="resv__next">` + 줄.map((r) => `
    <div class="nx">
      <p class="nx__tag">${esc(r.꼬리표)}</p>
      <p class="nx__when">${esc(r.when)}
        <span class="nx__dday${r.now ? ' is-now' : ''}">${esc(r.dday)}</span></p>
      <p class="nx__sub">${esc(r.sub)}</p>
    </div>`).join('') + `</div>`;
}

function resvDetail(f) {
  if (f.예약 === 0) {
    return `<p class="resv__detail">평일·비수기는 <b>선착순</b> — 매주 <b>수요일 오전 9시</b>에 6주 안쪽 날짜가 일주일씩 열립니다.
            다음 달 금·토·공휴일 전일과 여름 성수기(7/15~8/24)는 <b>추첨</b> — 매월 <b>4일 9시~9일 18시</b> 신청,
            <b>10일 16시</b> 발표, 미당첨·미결제분은 <b>15일 9시</b>에 선착순으로 풀립니다.</p>
            <p class="resv__detail resv__detail--note">추첨 대상 휴양림은 숲나들e 공지 기준으로 확정됩니다. 신청 전 확인하세요.</p>`;
  }
  if (f.예약 === 1) {
    return `<p class="resv__detail">매주 <b>수요일 오전 9시</b>에 6주 안쪽 날짜가 일주일씩 선착순으로 열립니다. 추첨 대상이 아닙니다.</p>`;
  }
  if (f.예약 === 2) {
    return `<p class="resv__detail">공립 휴양림은 지자체마다 정책이 다릅니다. 일부는 <b>월 추첨</b>이나 <b>지역주민 추첨</b>을 운영합니다.
            정확한 방식과 오픈 시각은 아래 숲나들e 페이지에서 확인하세요.</p>`;
  }
  return `<p class="resv__detail">사립 휴양림은 휴양림별로 예약 방식이 다릅니다. 아래 페이지에서 확인하세요.</p>`;
}

/* ---- 공유 ---- */

/* 공유한 링크가 그 휴양림을 바로 열어야 쓸모가 있다. 주소에 ?f=<휴양림id> 를 달아 두고
   들어올 때 읽는다. 지도 키를 넣는 ?key= 와 겹치지 않게 기존 파라미터는 건드리지 않는다. */
let 열린휴양림 = -1;

/* 공유 주소는 /f/<id>/ 를 쓴다. 그 폴더의 HTML 이 휴양림별 OG 태그를 들고 있어서
   카카오톡 미리보기에 그 휴양림 사진이 뜬다. ?f= 로도 들어올 수 있게 둔 건 그대로다. */
function forestUrl(f) {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  // 본체가 /forest-trip-map/ 같은 하위 경로에 있을 수도 있다. 파일명만 떼고 f/ 를 붙인다.
  u.pathname = u.pathname.replace(/[^/]*$/, '') + `f/${encodeURIComponent(f.id)}/`;
  return u.toString();
}

function setUrlForest(f) {
  const u = new URL(location.href);
  if (f) u.searchParams.set('f', f.id);
  else u.searchParams.delete('f');
  history.replaceState(null, '', u.pathname + u.search);
}

let 라벨되돌리기 = null;
function shareFeedback(text) {
  clearTimeout(라벨되돌리기);
  el.shareLabel.textContent = text;
  라벨되돌리기 = setTimeout(() => { el.shareLabel.textContent = '공유'; }, 1800);
}

async function shareForest() {
  if (열린휴양림 < 0) return;
  const f = F[열린휴양림];
  const url = forestUrl(f);
  const text = `${f.이름} — 전국 자연휴양림 한눈에`;

  // 휴대폰은 운영체제 공유 시트가 뜬다. 카카오톡도 거기서 고른다.
  if (navigator.share) {
    try {
      await navigator.share({ title: f.이름, text, url });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;   // 사용자가 닫은 것뿐이다
    }
  }
  if (await copyText(url)) {
    shareFeedback('주소 복사됨');
  } else {
    // 복사가 다 막힌 환경에서는 주소창에라도 남겨 둔다
    setUrlForest(f);
    shareFeedback('주소창에서 복사하세요');
  }
}

/** 클립보드 복사. 최신 API 가 막히면(권한 거부·비보안 출처) 옛 방식으로 한 번 더 시도한다. */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) { /* 아래 옛 방식으로 */ }

  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(ta);
  try {
    ta.select();
    ta.setSelectionRange(0, text.length);     // iOS 는 이게 있어야 선택된다
    return document.execCommand('copy');
  } catch (e) {
    return false;
  } finally {
    ta.remove();
  }
}

/** 주소에 ?f= 가 있으면 그 휴양림을 열어 준다. 없거나 못 찾으면 조용히 넘어간다. */
function openFromUrl() {
  const id = new URLSearchParams(location.search).get('f');
  if (!id) return;
  const i = F.findIndex((x) => x.id === id);
  if (i >= 0) openSheet(i);
}

let sheetOrigin = null;      // 상세가 빠져나온 목록 줄. 닫을 때 그 자리로 돌아간다
let sheetClosing = null;     // 닫히는 중이면 그걸 바로 끝내는 함수

/** 사라질 요소 대신 그 자리 사각형만 들고 있는 가짜 출발점. 들림·되돌아가기는 하지 않는다. */
function rectOrigin(r) {
  return {
    isConnected: true, getBoundingClientRect: () => r,
    animate: () => ({ set onfinish(fn) { fn(); } }),
    classList: { add() {}, remove() {} }, focus() {},
  };
}

function openSheet(i, origin) {
  if (sheetClosing) sheetClosing();
  const f = F[i];
  const t = f.유형 >= 0 ? f.유형 : 0;

  // 대표 사진 한 장을 먼저 깔고, sheet.json 이 오면 소개 사진 여러 장으로 바꾼다.
  // 목록 썸네일은 320px 로 받았으니 상세는 더 큰 걸 받는다.
  renderPhotos(f.사진 && D.이미지CDN ? [`${D.이미지CDN}${f.사진}?rs=800`] : []);
  renderFee(f, null);
  loadSheetData().then((all) => {
    if (열린휴양림 !== i) return;          // 그사이 다른 휴양림을 열었다
    const info = all[f.id];
    if (info && info.사진 && info.사진.length) renderPhotos(info.사진);
    renderFee(f, info);
  });

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
      `숲나들e 이용자 ${(f.관심 || 0).toLocaleString('ko-KR')}명이 관심 등록`
      + (D.인기도수집일 ? ` (${D.인기도수집일} 기준)` : '');
  } else {
    el.sheetPop.className = 'gauge__value gauge__value--none';
    el.sheetPop.textContent = '자료 없음';
    el.sheetPopSub.textContent = '숲나들e에 관심 등록 기능이 없는 시설입니다.';
  }

  // --- 예약 방식 ---
  el.sheetResv.innerHTML = `<p class="resv__head">예약 방식</p>`
    + `<p class="resv__way">${esc(D.예약라벨[f.예약])}</p>`
    + resvNext(f) + resvDetail(f);

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

  paintFav(el.sheetFav, favs.has(f.id));
  el.sheetFav.dataset.id = f.id;

  const 이미열림 = !el.sheetWrap.hidden;
  열린휴양림 = i;
  setUrlForest(f);
  el.sheetWrap.hidden = false;
  el.sheet.scrollTop = 0;
  document.body.classList.add('is-modal');
  if (!이미열림) {
    popIn({ box: el.sheet, shade: el.sheetShade }, origin || null);
    // 진짜 목록 줄이면 닫을 때 그 자리로 돌아가고, 위치만 빌린 경우에는 그냥 사라진다.
    sheetOrigin = origin && origin.nodeType ? origin : null;
    el.sheetClose.focus({ preventScroll: true });
  }
}

function closeSheet() {
  if (el.sheetWrap.hidden || sheetClosing) return;
  const origin = sheetOrigin;
  sheetOrigin = null;
  sheetClosing = popOut({ box: el.sheet, shade: el.sheetShade }, origin, () => {
    sheetClosing = null;
    el.sheetWrap.hidden = true;
    document.body.classList.remove('is-modal');
    if (origin && origin.isConnected) origin.focus({ preventScroll: true });
  });
  열린휴양림 = -1;
  setUrlForest(null);
}

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


/* ---- 지역 선택 (권역 -> 시·군·구) ---- */

function inKind(f) { return f.구분 === 자연휴양림; }

function buildAreaSelect() {
  const 수 = D.권역라벨.map(() => 0);
  F.forEach((f) => { if (inKind(f) && f.권역 >= 0) 수[f.권역]++; });

  const 전체 = 수.reduce((a, b) => a + b, 0);
  let html = opt('-1', '전국', 전체);
  D.권역라벨.forEach((label, i) => {
    if (!수[i]) return;
    html += opt(i, label, 수[i]);
  });
  el.areaSel.innerHTML = html;
  el.areaSel.value = String(filter.area);
}

function buildCitySelect() {
  // '권역인덱스|시군구' -> 개수. 같은 이름이 다른 권역에 있어도(고성군) 안 섞인다.
  const 수 = new Map();
  F.forEach((f) => {
    if (!inKind(f) || f.권역 < 0 || !f.시군구) return;
    if (filter.area >= 0 && f.권역 !== filter.area) return;
    const k = `${f.권역}|${f.시군구}`;
    수.set(k, (수.get(k) || 0) + 1);
  });

  const 전체 = [...수.values()].reduce((a, b) => a + b, 0);
  const one = (k) => opt(k, k.split('|')[1], 수.get(k));
  const 가나다 = (a, b) => a.split('|')[1].localeCompare(b.split('|')[1], 'ko');

  let html = opt('', '전체', 전체);
  if (filter.area >= 0) {
    html += [...수.keys()].sort(가나다).map(one).join('');
  } else {
    // 전국일 때는 118개가 한 줄로 쏟아진다. 권역으로 묶어 두면 훑기 쉽고,
    // 같은 이름이 둘 있어도(고성군) 어느 권역 것인지 바로 보인다.
    D.권역라벨.forEach((label, i) => {
      const keys = [...수.keys()].filter((k) => k.startsWith(`${i}|`)).sort(가나다);
      if (!keys.length) return;
      html += `<optgroup label="${esc(label)}">${keys.map(one).join('')}</optgroup>`;
    });
  }
  el.citySel.innerHTML = html;
  el.citySel.value = 수.has(filter.city) ? filter.city : (filter.city = '');
}

/** 셀렉트 항목. 펼친 목록에는 '계곡 (38)' 처럼 개수를 붙이고, 고른 뒤 닫힌 칸에는
    '계곡' 만 보인다(compactSelects). 휴대폰에서 칸 셋이 한 줄에 서면 개수까지는 안 들어간다.
    고른 결과의 개수는 바로 위 '○○곳' 에 나온다. */
function opt(value, label, n) {
  return `<option value="${esc(String(value))}" data-l="${esc(label)}" data-n="${n.toLocaleString('ko-KR')}">`
       + `${esc(label)} (${n.toLocaleString('ko-KR')})</option>`;
}

function compactSelects() {
  [el.areaSel, el.citySel, el.tagSel].forEach((sel) => {
    for (const o of sel.options) {
      if (!o.dataset.l) continue;
      o.textContent = o.selected ? o.dataset.l : `${o.dataset.l} (${o.dataset.n})`;
    }
  });
}

/** 고른 값이 있으면 셀렉트를 초록으로 칠해, 필터가 걸려 있다는 걸 눈에 띄게 한다. */
function markSelects() {
  compactSelects();
  el.areaSel.closest('.sel').classList.toggle('sel--on', filter.area >= 0);
  el.citySel.closest('.sel').classList.toggle('sel--on', !!filter.city);
  el.tagSel.closest('.sel').classList.toggle('sel--on', filter.tag >= 0);
}

function refreshRegion() {
  buildAreaSelect();
  buildCitySelect();
  markSelects();
}

/** 특징 셀렉트에 쓸 태그. 숲나들e 원본 태그는 '등산'·'등산로'처럼 비슷한 게 여럿이라
    고르기 어렵다. 앞쪽에 깔아 둔 특징 태그만 쓰고, 원본 태그는 상세 화면 배지로만
    보여 준다. 해당하는 곳이 너무 적은 특징도 뺀다. 개수는 권역 셀렉트처럼 전국 기준. */
function topTags() {
  const 특징수 = D.특징태그수 || D.태그라벨.length;
  const count = D.태그라벨.map(() => 0);
  F.forEach((f) => { if (inKind(f)) f.태그.forEach((n) => { count[n]++; }); });
  return D.태그라벨
    .map((t, n) => ({ t, n, c: count[n] }))
    .filter((x) => x.n < 특징수 && x.c >= 5)
    .sort((a, b) => b.c - a.c);
}

function buildTagSelect() {
  const 전체 = F.filter(inKind).length;
  el.tagSel.innerHTML = opt('-1', '전체', 전체) + topTags().map((x) => opt(x.n, x.t, x.c)).join('');
  el.tagSel.value = String(filter.tag);
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

/* ---------------- 로그인 · 즐겨찾기 ---------------- */

/* 로그인과 즐겨찾기는 서버(api/)에 있다. 로그인 쿠키는 HttpOnly 라 JS 가 읽을 수 없으니
   로그인했는지는 /api/me 에 물어봐야 안다. 즐겨찾기는 휴양림 id 만 주고받는다. */
let me = null;                 // { nickname } 또는 null
const favs = new Set();        // 즐겨찾기한 휴양림 id

const HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.6-4.6-9.3-9.4C1.5 7.6 3.6 4.4 7.1 4.4c2.1 0 3.7 1.1 4.9 2.8 1.2-1.7 2.8-2.8 4.9-2.8 3.5 0 5.6 3.2 4.4 6.5-1.7 4.8-9.3 9.4-9.3 9.4z"/></svg>';

function heartButton(f) {
  const on = favs.has(f.id);
  return `<button class="heart${on ? ' is-on' : ''}" type="button" data-id="${esc(f.id)}"
    aria-pressed="${on}" aria-label="${esc(f.이름)} 즐겨찾기">${HEART_SVG}</button>`;
}

function paintFav(btn, on) {
  btn.classList.toggle('is-on', on);
  btn.setAttribute('aria-pressed', String(on));
  const label = btn.querySelector('.fav__label');
  if (label) label.textContent = on ? '저장됨' : '즐겨찾기';
}

/** 화면에 떠 있는 그 휴양림의 하트(목록 줄·상세)과 칩 숫자를 한꺼번에 맞춘다. */
function paintFavs(id) {
  const on = favs.has(id);
  el.list.querySelectorAll(`.heart[data-id="${CSS.escape(id)}"]`).forEach((b) => paintFav(b, on));
  if (el.sheetFav.dataset.id === id) paintFav(el.sheetFav, on);
  el.favN.textContent = favs.size;
}

function renderAuth() {
  el.auth.innerHTML = me
    ? `<span class="auth__name">${esc(me.nickname || '로그인됨')}</span>
       <button class="auth__btn" id="logout" type="button">로그아웃</button>`
    : `<a class="auth__btn auth__btn--kakao" href="/api/auth/login">카카오 로그인</a>`;
  el.auth.hidden = false;
  el.favChip.hidden = !me;
  if (!me && filter.fav) { filter.fav = false; search(); }
}

/** 카카오에서 돌아오면 주소에 ?login=ok|fail|cancel 이 붙어 있다. 읽고 지운다. */
function takeLoginResult() {
  const u = new URL(location.href);
  const r = u.searchParams.get('login');
  if (!r) return;
  u.searchParams.delete('login');
  history.replaceState(null, '', u.pathname + u.search);
  if (r === 'fail') alert('로그인하지 못했어요. 잠시 뒤 다시 시도해 주세요.');
}

async function loadMe() {
  takeLoginResult();
  try {
    const r = await fetch('/api/me');
    // 정적 서버로만 띄웠을 때처럼 API 가 없으면 로그인 칸을 아예 보이지 않는다.
    if (r.status !== 200 && r.status !== 401) return;
    me = r.ok ? (await r.json()).user : null;
  } catch (e) { return; }
  if (me) {
    try {
      const r = await fetch('/api/favorites');
      if (r.ok) (await r.json()).ids.forEach((id) => favs.add(id));
    } catch (e) { /* 하트만 비어 보인다 */ }
  }
  renderAuth();
  el.favN.textContent = favs.size;
  // 이미 그려 둔 하트를 받아 온 즐겨찾기에 맞춘다.
  el.list.querySelectorAll('.heart').forEach((b) => paintFav(b, favs.has(b.dataset.id)));
  if (el.sheetFav.dataset.id) paintFav(el.sheetFav, favs.has(el.sheetFav.dataset.id));
  measureControls();
}

/** 하트를 누르면 화면부터 바꾸고 서버에 보낸다(낙관적 업데이트). 실패하면 되돌린다. */
async function toggleFav(id) {
  if (!id) return;
  if (!me) {
    if (confirm('즐겨찾기는 카카오 로그인 후 쓸 수 있어요.\n로그인할까요?')) location.href = '/api/auth/login';
    return;
  }
  const on = !favs.has(id);
  if (on) favs.add(id); else favs.delete(id);
  paintFavs(id);
  try {
    const r = await fetch(`/api/favorites/${encodeURIComponent(id)}`, { method: on ? 'PUT' : 'DELETE' });
    if (r.status === 401) { me = null; renderAuth(); throw new Error('login'); }
    if (!r.ok) throw new Error(String(r.status));
  } catch (e) {
    if (on) favs.delete(id); else favs.add(id);
    paintFavs(id);
    alert(e.message === 'login' ? '로그인이 풀렸어요. 다시 로그인해 주세요.' : '저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.');
  }
}

async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) { /* 아래에서 화면은 비운다 */ }
  me = null;
  favs.clear();
  renderAuth();
  el.favN.textContent = 0;
  el.list.querySelectorAll('.heart.is-on').forEach((b) => paintFav(b, false));
  paintFav(el.sheetFav, false);
}

/* ---------------- init ---------------- */

function init() {
  startHero();
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

  el.areaSel.addEventListener('change', () => {
    filter.area = +el.areaSel.value;
    filter.city = '';                      // 권역이 바뀌면 시·군·구는 처음으로
    refitNext = true;
    buildCitySelect();
    markSelects();
    search();
  });
  el.tagSel.addEventListener('change', () => {
    filter.tag = +el.tagSel.value;
    refitNext = true;
    markSelects();
    search();
  });
  el.citySel.addEventListener('change', () => {
    filter.city = el.citySel.value;
    refitNext = true;
    markSelects();
    search();
  });

  el.schedToggle.addEventListener('click', () => {
    setSchedOpen(el.schedToggle.getAttribute('aria-expanded') !== 'true');
    measureControls();
  });

  el.more.addEventListener('click', renderMore);

  el.list.addEventListener('click', (e) => {
    const heart = e.target.closest('.heart');
    if (heart) { toggleFav(heart.dataset.id); return; }  // 하트는 상세를 열지 않는다
    const row = e.target.closest('.row');
    if (row) openSheet(results[+row.dataset.n], row);
  });
  el.list.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest('.heart')) return;              // 버튼 자체의 Enter·Space 에 맡긴다
    const row = e.target.closest('.row');
    if (row) { e.preventDefault(); openSheet(results[+row.dataset.n], row); }
  });

  el.sheetClose.addEventListener('click', closeSheet);
  el.sheetShade.addEventListener('click', closeSheet);
  el.sheetPhotos.addEventListener('scroll', debounce(updatePhotoCount, 60), { passive: true });
  el.photoPrev.addEventListener('click', () => stepPhoto(-1));
  el.photoNext.addEventListener('click', () => stepPhoto(1));
  el.sheetFee.addEventListener('click', (e) => {
    const btn = e.target.closest('.fee__toggle');
    if (!btn) return;
    el.sheetFee.querySelectorAll('.fee__more').forEach((tr) => { tr.hidden = false; });
    btn.remove();
  });
  el.sheetShare.addEventListener('click', shareForest);
  el.sheetFav.addEventListener('click', () => toggleFav(el.sheetFav.dataset.id));
  el.favChip.addEventListener('click', () => {
    filter.fav = !filter.fav;
    el.favChip.setAttribute('aria-pressed', String(filter.fav));
    refitNext = true;
    search();
  });
  el.auth.addEventListener('click', (e) => {
    if (e.target.closest('#logout')) logout();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!el.spopWrap.hidden) closeSchedPop(); else closeSheet();
  });
  el.schedCards.addEventListener('click', (e) => {
    const card = e.target.closest('.scard');
    if (card) openSchedPop(card);
  });
  el.spopClose.addEventListener('click', closeSchedPop);
  el.spopShade.addEventListener('click', closeSchedPop);
  el.spopBody.addEventListener('click', (e) => {
    const hot = e.target.closest('.hot__item');
    if (!hot) return;
    // 일정 팝업을 바로 닫고, 누른 줄에서 휴양림 상세가 빠져나오게 한다.
    // 줄은 일정 팝업과 함께 사라지므로 위치만 빌린다.
    const ghost = hot.getBoundingClientRect();
    closeSchedPop(true);
    openSheet(Number(hot.dataset.i), rectOrigin(ghost));
  });

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

      buildTagSelect();
      refreshRegion();

      search();
      measureControls();
      openFromUrl();
      loadMe();
      tryBootMap();
    })
    .catch(() => {
      el.scope.textContent = '자료를 불러오지 못했습니다. 새로고침해 주세요.';
    });
}

init();
