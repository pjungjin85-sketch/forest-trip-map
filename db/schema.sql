-- 즐겨찾기용 테이블. 여러 번 돌려도 안전하도록 if not exists 로 만든다.

-- 카카오로 로그인한 사람. 카카오 토큰은 저장하지 않고 회원번호만 둔다.
create table if not exists users (
  id          bigserial primary key,
  kakao_id    bigint unique not null,
  nickname    text,
  created_at  timestamptz not null default now()
);

-- 로그인 상태. 쿠키에는 토큰 원본, 여기에는 그 해시만 둔다.
-- DB 가 새어 나가도 이 값으로는 로그인할 수 없다.
create table if not exists sessions (
  token_hash  text primary key,
  user_id     bigint not null references users on delete cascade,
  expires_at  timestamptz not null
);

-- forest_id 는 forests.json 의 id 그대로('0111'). 숫자로 바꾸면 앞의 0 이 사라진다.
create table if not exists favorites (
  user_id     bigint not null references users on delete cascade,
  forest_id   text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, forest_id)
);
